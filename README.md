# Compakt Plugin

**Compakt** is an OpenClaw plugin that provides efficient context compaction for local LLMs by chunking conversation history and summarizing each chunk. It builds on the original *jasper-context-compactor* project, extending it with the new **CompactionProvider** API and proper message removal handling.

## Model Selection Guide

| Context Window | Peak VRAM | Best For |
|----------------|-----------|----------|
| 32K (recommended) | ~8.6 GB | Preserving detailed context, long conversations |
| 8K | ~7.5 GB | Memory-constrained GPUs (12GB), general conversation continuity |
| 4K+ | Lower | Only if VRAM is extremely tight, will lose significant detail |

**Trade-off:** Smaller context windows save VRAM but lose fine-grained details. 
Use 32K if you need the model to recall specific detailed information.

## Performance

Compakt dramatically reduces VRAM usage during context compaction:

| Metric | Before Compakt | With Compakt |
|--------|---------------|--------------|
| Peak VRAM | ~13.9 GB | **~8.6 GB** |
| Compaction time | 6+ minutes | **~20 seconds** |
| VRAM reduction | — | **38%** |

The VRAM spike during Compakt compaction is essentially just the compaction model loading — chunked processing adds **near-zero overhead**.

### Measured on RTX 4060 Ti (16GB VRAM)

| Component | VRAM |
|-----------|------|
| System + browser baseline | ~2.1 GB |
| Compaction model (qwen3.5-32k) | ~6.5 GB |
| Compakt peak during compaction | ~8.6 GB |

**Note:** Peak VRAM varies based on your system baseline (browser tabs, other apps). Measurements above were taken with a ~2.1 GB baseline. Your baseline may be higher if you have more applications running, but the relative savings remain consistent.

## Quick Start

### 1. Create a Compaction Model

Compakt needs a model configured for summarization. Create one with sufficient context window:

```bash
# Example: Create a 32K context model from qwen3.5:4b
ollama create qwen3.5-compaction-32k -f - <<EOF
FROM qwen3.5:4b
PARAMETER num_ctx 32768
PARAMETER temperature 0.3
PARAMETER top_k 20
PARAMETER top_p 0.95
PARAMETER presence_penalty 1.5
EOF
```

**Important:** The `num_ctx` must match or exceed your `chunkContextWindow` config (default: 8192).

### 2. Install the Plugin

```bash
# Install from ClawHub (recommended)
openclaw plugins install compakt

# Or install locally from source
npm install -g .
```

### 3. Configure

Edit `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "compakt": {
        "config": {
          "summaryModel": "ollama/qwen3.5-compaction-32k",
          "chunkContextWindow": 32768
        }
      }
    }
  }
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enables or disables the plugin. |
| `summaryModel` | string | `""` | **Required.** Model used for summarization (e.g., `ollama/qwen3.5-compaction-32k`). |
| `ollamaBaseUrl` | string | `http://127.0.0.1:11434` | Ollama API URL. Can also set `OLLAMA_BASE_URL` env var (takes precedence). |
| `summaryMaxTokens` | number | `1000` | Maximum tokens for the summarizer output (100-32000). |
| `charsPerToken` | number | `4` | Characters per token for estimation. Use 4 for English, 2-3 for code. |
| `chunkContextWindow` | number | `8192` | **Must match your model's `num_ctx`.** Context window for chunking. |
| `chunkOverlap` | number | `500` | Overlapping tokens between chunks for continuity. |
| `logLevel` | enum | `info` | Logging verbosity (debug, info, warn, error). |

### Requirements

- OpenClaw gateway running locally
- Ollama instance at `http://127.0.0.1:11434` (configurable via `ollamaBaseUrl` or `OLLAMA_BASE_URL`)
- Compaction model installed: `ollama pull qwen3.5-compaction-32k`

### Provider Support

Currently supports **Ollama providers only**. Other providers (Anthropic, OpenAI, etc.) will log a warning and skip compaction.

### Context Window Matching

**Critical:** `chunkContextWindow` must be ≤ your model's `num_ctx`.

| Model num_ctx | Recommended chunkContextWindow |
|---------------|-------------------------------|
| 8192 (8K) | 8192 |
| 16384 (16K) | 16384 |
| 32768 (32K) | 32768 |

If you set `chunkContextWindow` higher than `num_ctx`, summarization will fail.

### Example Setups

**8K Model (most common):**
```json
{
  "summaryModel": "ollama/qwen3.5-compaction",
  "chunkContextWindow": 8192,
  "chunkOverlap": 500
}
```

**32K Model (large contexts):**
```json
{
  "summaryModel": "ollama/qwen3.5-compaction-32k",
  "chunkContextWindow": 32768,
  "chunkOverlap": 1000
}
```

## Usage

The plugin registers a `/context-stats` command:

```text
/user: /context-stats
assistant: ⚙️ Compakt stats:
- Model: ollama/qwen3.5-compaction-32k
- Estimated tokens (all messages): 1234
- Chunk count: 3
```

## How It Works

1. **Token Estimation**: Counts tokens using character heuristic (chars ÷ charsPerToken)
2. **Chunking**: Splits messages into chunks that fit within `chunkContextWindow`
3. **Overlap**: Each chunk overlaps by `chunkOverlap` tokens for continuity
4. **Summarization**: Each chunk is summarized by the configured model
5. **Fallback**: If summarization fails, raw message snippets are preserved with `[FALLBACK]` prefix

## Troubleshooting

### Compakt not activating

**Symptom:** Compaction uses fallback LLM instead of Compakt.

**Cause:** The `provider` field must be in `~/.openclaw/openclaw.json`, not `config.yaml`.

**Fix:** Add to `openclaw.json`:
```json
{
  "agents": {
    "defaults": {
      "compaction": {
        "provider": "compakt",
        "model": "ollama/qwen3.5-compaction-32k"
      }
    }
  }
}
```

### Verify Compakt is active

Check logs for:
```
[Compakt.summarize] Called with summaryModel=ollama/qwen3.5-compaction-32k
[Compakt.summarize] Complete: outputTokens=X, compression=Y%
```

If you see these logs, Compakt is working. If not, check:
1. `provider: "compakt"` in `openclaw.json` under `agents.defaults.compaction`
2. `summaryModel` is set correctly
3. Ollama is running and the model is installed

### Compression shows negative percentage

This means the summary is larger than the input — expected when summarizing small contexts. Compakt still preserves context continuity via overlap.

## Attribution

Based on **jasper-context-compactor** by **E.x.O. Entertainment Studios Inc.**
<https://github.com/E-x-O-Entertainment-Studios-Inc/openclaw-context-compactor>

## License

MIT License. See LICENSE file for details.

## Differences from Original

- Implements new **CompactionProvider** API
- Handles message removal correctly
- Configurable chunking for models with smaller context windows
- `/context-stats` command for debugging
- AbortSignal support for cancellation
- `[FALLBACK]` prefix for degraded output visibility