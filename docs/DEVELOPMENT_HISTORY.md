# Compakt Plugin Development History

**Created:** 2026-04-20
**Status:** Ready for testing

---

## Overview

Compakt is a chunked context compaction plugin for OpenClaw that solves compaction performance issues with local LLMs. It was experiencing 6+ minute compaction times due to KV cache overflow when using local models with limited context windows.

The plugin chunks conversation history, summarizes each chunk with a dedicated compaction model, and provides context continuity through overlap regions.

**Based on:** Jasper Context Compactor by E.x.O. Entertainment Studios Inc.
**License:** MIT (with attribution to original)

---

## Why Compakt?

OpenClaw's built-in compaction sends the entire conversation history to the LLM for summarization. With local models having small context windows (8K-32K tokens), large conversations overflow the KV cache, causing:
- 6+ minute compaction times
- OOM errors
- Failed compactions

Compakt solves this by:
1. Estimating tokens per message
2. Chunking messages to fit within model context
3. Summarizing each chunk separately
4. Accumulating summaries for context continuity

---

## Development Timeline

### Phase 1: Research (2026-04-20)

**Goal:** Find existing solutions for chunked compaction

1. Cloned Jasper Context Compactor from GitHub
   - URL: https://github.com/E-x-O-Entertainment-Studios-Inc/openclaw-context-compactor
2. Analyzed implementation:
   - Used legacy `useHook` API
   - Could only add messages, not remove stale ones
   - No CompactionProvider support
3. Discovered OpenClaw has `registerCompactionProvider()` API
   - Located at: `openclaw/dist/plugin-sdk/src/plugins/compaction-provider.d.ts`
   - Interface: `id`, `label`, `summarize(params)`
   - This is the modern way to do compaction

**Decision:** Build new plugin using CompactionProvider API

---

### Phase 2: Initial Development

**Developer:** Ada (code agent)
**Files created:**

| File | Purpose |
|------|---------|
| `src/index.ts` | Plugin entry, CompactionProvider registration |
| `src/chunker.ts` | Token-based message chunking |
| `src/summarizer.ts` | LLM summarization with fallback |
| `src/token-estimator.ts` | chars÷token heuristic |
| `src/commands.ts` | `/context-stats` command |
| `openclaw.plugin.json` | Config schema |
| `package.json` | npm metadata |
| `cli.js` | Interactive setup script |
| `README.md` | Documentation |
| `LICENSE` | MIT license with attribution |
| `tests/index.test.ts` | Unit tests |

**Key design decisions:**
- Use `estimateTokens(text, charsPerToken)` heuristic (4 chars/token for English)
- Calculate `effectiveChunkTokens = floor(contextWindow / 1.2) - 4096` for safety margin
- Support overlap for context continuity
- Graceful fallback: raw message snippets with `[FALLBACK]` prefix when LLM fails

---

### Phase 3: Code Review Senate

**5 reviewers spawned with different models:**

| Model | Focus |
|-------|-------|
| kimi-k2.5:cloud | General correctness |
| qwen3.5:cloud | Security, validation |
| minimax-m2.7:cloud | Correctness, edge cases |
| gpt-oss:120b-cloud | OpenClaw API compatibility |
| nematron-3-super:cloud | Production readiness |

**Findings:**

#### Critical Issues (must fix)
1. **Syntax error** - `summarizer.ts` line 59 missing `: fallback` in ternary
2. **Overlap calculation bug** - `startIdx` could skip messages
3. **previousSummary not used** - Never injected into prompts
4. **summarizationInstructions dropped** - Parameter accepted but ignored
5. **enabled flag ignored** - Plugin registered even when disabled
6. **CLI NaN handling** - Non-numeric input causes crashes

#### Important Issues (should fix)
1. Empty messages returns `[[]]` instead of `[]`
2. AbortSignal not checked between chunks (5/5 reviewers)
3. Fallback truncation unclear - no `[FALLBACK]` marker
4. Config schema mismatch - all fields required but have defaults

#### Test Failures
1. Emoji token count - test expected 1, actual is 2
2. Overlap test - brittle message equality check

**Cross-reference:** `reviews/cross-reference.md`

---

### Phase 4: Fix Implementation

**Developer:** Ada (code agent)
**Verified by:** DeepSeek Vera

All critical and important issues fixed:
- ✅ Syntax error corrected
- ✅ Overlap calculation fixed to ensure message continuity
- ✅ `previousSummary` injected into chunk prompts
- ✅ `summarizationInstructions` included in prompt template
- ✅ `enabled === false` check before registration
- ✅ Empty messages returns `[]`
- ✅ AbortSignal check at start of each chunk iteration
- ✅ `[FALLBACK]` prefix added to degraded output
- ✅ CLI validates numeric inputs
- ✅ Tests updated

**Test result:** All tests pass

---

### Phase 5: Public Release Preparation

**Changes for public usability:**

| Setting | Before | After |
|---------|--------|-------|
| `summaryModel` default | `ollama/qwen3.5-compaction` | `""` (required) |
| `chunkContextWindow` default | 32768 | 8192 (safer) |
| Config validation | None | `minimum`/`maximum` constraints |
| Required fields | All 7 | None (all have defaults) |

**README updated with:**
- Quick start guide
- Model creation instructions
- Context window matching table
- Example configurations for 8K/16K/32K models
- Clear error message if model not configured

---

### Phase 6: Model Creation

Created dedicated compaction model:

```bash
ollama create qwen3.5-compaction-32k -f - <<EOF
FROM qwen3.5-compaction:latest
PARAMETER num_ctx 32768
EOF
```

**Model specs:**
- Base: qwen3.5:4b (3.4GB)
- Context: 32K tokens
- Temperature: 0.3
- Top-k: 20, Top-p: 0.95
- Presence penalty: 1.5

---

### Phase 7: Installation & Compilation

**Initial attempt failed:**
- OpenClaw expected compiled JavaScript, not TypeScript
- Error: `missing register/activate export`
- Error: `plugin manifest not found`

**Fix:**
- Created `tsconfig.json` with ES2022/bundler settings
- Installed TypeScript and @types/node
- Compiled to `dist/` directory
- Added `dist/openclaw.plugin.json` (manifest alongside compiled entry)
- Updated `package.json`:
  - `"main": "dist/index.js"`
  - `"openclaw.extensions": "dist/index.js"`

**Final structure:**
```
compakt/
├── dist/
│   ├── index.js          ← Compiled entry
│   ├── openclaw.plugin.json
│   └── *.js              ← Compiled modules
├── src/
│   ├── index.ts          ← TypeScript source
│   ├── chunker.ts
│   ├── summarizer.ts
│   └── ...
├── openclaw.plugin.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Critical Bug: ESM Import Resolution (2026-04-21)

### Problem
The compiled `dist/index.js` failed to load with error:
```
[plugins] compakt missing register/activate export
ERR_MODULE_NOT_FOUND: Cannot find module './summarizer'
```

OpenClaw's plugin loader uses `resolvePluginModuleExport()` which:
1. Imports the module via dynamic ESM import
2. Extracts `{ definition, register }` from the exported object
3. Returns `{}` if module fails to load

The module was failing silently because Node.js ESM requires explicit file extensions in imports.

### Root Cause
TypeScript was outputting:
```js
import { summarize } from "./summarizer";
```

But Node.js ESM resolution needs:
```js
import { summarize } from "./summarizer.js";
```

TypeScript **does not auto-add extensions** — it preserves what you write in source.

### Solution

1. **tsconfig.json** — Use Node16 module resolution:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16"
  }
}
```

2. **package.json** — Add ESM type:
```json
{
  "type": "module"
}
```

3. **Source imports** — Include `.js` extensions:
```typescript
// src/index.ts
import { summarize } from "./summarizer.js";  // ✅ Include .js

// src/summarizer.ts
import { estimateTokens } from "./token-estimator.js";
const { chunkMessages } = await import("./chunker.js");
```

4. **Rebuild** — Output now has correct imports:
```js
// dist/index.js
import { summarize } from "./summarizer.js";
export const id = "compakt";
export function register(api) { ... }
```

### Additional Fixes
- Removed unused `import { registerCompactionProvider } from "openclaw/dist/plugin-sdk"` — the plugin uses `api.registerCompactionProvider()` from the passed-in API
- Added default values for optional config params to fix TypeScript strict null errors:
  - `chunkContextWindow: chunkContextWindow ?? 8192`
  - `chunkOverlap: chunkOverlap ?? 500`

### Why This Matters for Public Release
- Anyone cloning the repo and running `npm run build` will get working ESM
- Pre-built `dist/` works without hacks
- Standard approach for published npm packages
- TypeScript preserves what you write — extensions must be in source

### Config Model Mismatch (Also Fixed)
The built-in compaction fallback was configured to use `qwen3.5-compaction` while Compakt's plugin config used `qwen3.5-compaction-32k`. If Compakt failed to load, the fallback would use a smaller context model.

**Fixed:** Updated `agents.defaults.compaction.model` to `ollama/qwen3.5-compaction-32k` so both paths use the 32K model.

### Verification
After fix:
```
[gateway] ready (4 plugins: compakt, discord, memory-core, openclaw-web-search; 2.5s)
```

No "missing register/activate export" errors.

---

## Configuration

### OpenClaw config (`~/.openclaw/openclaw.json`)

```json
{
  "plugins": {
    "allow": ["compakt", "..."],
    "entries": {
      "compakt": {
        "enabled": true,
        "config": {
          "summaryModel": "ollama/qwen3.5-compaction-32k",
          "chunkContextWindow": 32768,
          "chunkOverlap": 1000
        }
      }
    },
    "load": {
      "paths": ["/home/gilliangroks/.openclaw/workspace/projects/compakt"]
    }
  }
}
```

### Config options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable/disable plugin |
| `summaryModel` | string | "" (required) | Model for summarization |
| `chunkContextWindow` | number | 8192 | Must match model's `num_ctx` |
| `chunkOverlap` | number | 500 | Overlapping tokens between chunks |
| `summaryMaxTokens` | number | 1000 | Max tokens for summary output |
| `charsPerToken` | number | 4 | Estimation heuristic |
| `logLevel` | enum | info | debug, info, warn, error |

---

## Key Decisions

1. **Local models only** - No cloud API keys required
2. **Compaction model** - qwen3.5-compaction-32k (4B params, 32K context)
3. **Agent model** - glm-5.1:cloud (128K context)
4. **MIT license** - With attribution to Jasper Context Compator
5. **Public-ready defaults** - Safer defaults for public release

---

## Files

### Source Files (`src/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 50 | Plugin entry, CompactionProvider registration |
| `chunker.ts` | 60 | Token-based message chunking |
| `summarizer.ts` | 80 | LLM summarization with fallback |
| `token-estimator.ts` | 15 | chars÷token estimation |
| `commands.ts` | 30 | `/context-stats` command |

### Config Files

| File | Purpose |
|------|---------|
| `openclaw.plugin.json` | Plugin manifest, config schema |
| `package.json` | npm metadata |
| `tsconfig.json` | TypeScript compilation |
| `README.md` | User documentation |
| `LICENSE` | MIT license |

### Test Files (`tests/`)

| File | Purpose |
|------|---------|
| `index.test.ts` | Unit tests for all modules |

### Review Files (`reviews/`)

| File | Reviewer |
|------|-----------|
| `kimi-k2.5-review.md` | Kimi findings |
| `qwen3.5-review.md` | Qwen findings |
| `minimax-m2.7-review.md` | MiniMax findings |
| `gpt-oss-120b-review.md` | GPT-OSS findings |
| `nemotron-3-super-review.md` | Nemotron findings |
| `cross-reference.md` | Consolidated findings |

---

## Next Steps

1. **Gateway restart** - Load the plugin
2. **Verify load** - Check OpenClaw status for plugin
3. **Test compaction** - Trigger compaction in a long session
4. **Monitor performance** - Compare 6+ min to expected seconds

---

## Critical Bug: LLM API Non-Existent (2026-04-21)

### Problem
The original `summarizer.ts` used a non-existent API:

```typescript
const result = await api.runtime?.llm?.complete({
  model: summaryModel,
  messages: [{ role: "user", content: prompt }],
  maxTokens: summaryMaxTokens,
  signal,
});
```

**However, `api.runtime.llm` does NOT exist in the OpenClaw plugin SDK.** The PluginRuntimeCore type provides:
- `agent` - for running embedded agents
- `media`, `tts`, `imageGeneration`, etc.
- `webSearch`, `stt`
- `modelAuth` - for auth credentials
- `config`, `system`, `events`, `logging`, `state`, `tasks`

**But NO `llm` property with `complete()` method.**

### Why It Failed Silently
Optional chaining (`?.`) returns `undefined` without error. The summarization never ran, causing:
- Compaction to hang for 8+ minutes
- Cloud model timeouts (fallback chain exhausted)
- No chunk logs in the output

### Solution: Direct Ollama HTTP API

The `runEmbeddedPiAgent()` API requires 30+ parameters (sessionId, sessionFile, workspaceDir, timeoutMs, runId, etc.) — designed for full agent sessions, not simple LLM completions.

**For a public npm package, direct HTTP is simpler:**

```typescript
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || cfg.ollamaBaseUrl || 'http://127.0.0.1:11434';

const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: modelName,
    prompt,
    stream: false,
    options: {
      num_predict: summaryMaxTokens,
      temperature: 0.3,
    },
  }),
  signal,
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `summaryModel` | string | Required | Model for summarization (e.g., `ollama/qwen3.5-compaction-32k`) |
| `ollamaBaseUrl` | string | `http://127.0.0.1:11434` | Ollama API URL (env var `OLLAMA_BASE_URL` takes precedence) |
| `chunkContextWindow` | number | 8192 | Context window per chunk |
| `chunkOverlap` | number | 500 | Token overlap between chunks |
| `summaryMaxTokens` | number | 1000 | Max tokens per summary |

### Requirements

- OpenClaw gateway running locally
- Ollama instance at `http://127.0.0.1:11434` (configurable)
- Compaction model installed: `ollama pull qwen3.5-compaction-32k`

### Provider Support

Currently supports **Ollama providers only**. Other providers (Anthropic, OpenAI, etc.) will log a warning and skip compaction.

---

## Credits

- **Original concept:** Jasper Context Compactor by E.x.O. Entertainment Studios Inc.
- **Plugin development:** Ada (OpenClaw code agent)
- **Code reviews:** Kimi, Qwen, MiniMax, GPT-OSS, Nematron, DeepSeek
- **Project coordination:** Gillian Groks