# Compakt Code Review - GPT-OSS 120B

**Model:** ollama/gpt-oss:120b-cloud
**Date:** 2026-04-20

## 1. CRITICAL

### C1. Failing Test: Emoji Token Count (`tests/index.test.ts`)
Test expects `estimateTokens('😀😀😀', 4) === 1`, but emoji is 2 UTF-16 code units each, so string length is 6. Function returns `ceil(6/4) = 2`. Test will always fail.
- **Fix:** Correct test expectation to 2, or clarify test intent.

### C2. Brittle Overlap Test (`tests/index.test.ts`)
Test assumes last message of chunk 0 equals first message of chunk 1, but overlap algorithm works on token counts, not message boundaries. With partial-message overlap, equality assertion is brittle and will intermittently fail.
- **Fix:** Test overlapping content presence, not exact message equality.

### C3. `enabled` Flag Ignored (`src/index.ts`)
Plugin registers CompactionProvider unconditionally, ignoring `enabled` config setting. If user disables plugin, it still runs.
- **Fix:** Check `cfg.enabled !== false` before registering.

### C4. CLI Input Validation (`cli.js`)
Reads user values and writes verbatim to `openclaw.json`. Non-numeric input becomes `NaN`, propagating into token calculations causing crashes or division-by-zero.
- **Fix:** Validate numeric inputs, reject NaN, sanitize strings.

## 2. IMPORTANT

### I6. Empty Messages Returns `[[]]` (`src/chunker.ts`)
When `messages` is empty, function returns `[[]]` instead of `[]`. Downstream iterates over one empty chunk unnecessarily.
- **Fix:** Return `[]` early for empty array.

### I7. AbortSignal Not Checked Between Chunks (`src/summarizer.ts`)
Function forwards `signal` to LLM call but never checks `signal.aborted` before starting next chunk. Aborted signal after first chunk continues requesting completions.
- **Fix:** Add `if (signal?.aborted) break;` at start of each chunk iteration.

### I8. Non-Standard Command API Surface (`src/commands.ts`)
Uses `api.sendMessage` then `ctx.send` fallback. OpenClaw command API expects `return` string or `ctx.reply`. Non-standard surface may break on some versions.
- **Fix:** Add `ctx.reply` fallback for compatibility.

### I9. Token Estimation Minimum 1 Token (`src/token-estimator.ts`)
`Math.max(1, ...)` forces minimum 1 token for any non-empty string. Fine for most LLMs but distorts estimates for very short strings. Should be documented.
- **Fix:** Document minimum token behavior.

### I10. `logLevel` Config Ignored (`src/index.ts`, `src/summarizer.ts`)
Schema defines `logLevel` enum but code never reads or respects it. Mismatch against declared schema.
- **Fix:** Use `logLevel` for logging or remove from schema.

## 3. NITPICKS

### N1. `api` Typed as `any` (`src/index.ts`)
Replace with `OpenClawPluginAPI` interface or minimal typed subset.
- **Fix:** Import and use proper type.

### N2. `any` Types for `messages` (`src/chunker.ts`)
Define `Message` interface (`{ role?: string; content: string; }`) for type safety.
- **Fix:** Add minimal type.

### N3. `any` for `summarizationInstructions` (`src/summarizer.ts`)
Type it explicitly if expected to be string or structured object.
- **Fix:** Add proper type.

### N4. CLI Prompts Not Trimmed (`cli.js`)
User input could have accidental leading/trailing spaces.
- **Fix:** `input.trim()` before using.

### N5. Ad-Hoc Test Runner (`tests/index.test.ts`)
Consider `node:test` or `jest` for proper isolation and reporting.
- **Fix:** Use standard test framework.

### N6. `main` Points to TypeScript (`package.json`)
`main: "src/index.ts"` works for OpenClaw dynamic loading but not published npm packages. Should point to compiled JS.
- **Fix:** Add `build` script and point to `dist/index.js`.

### N7. No README
Missing documentation for installation, config, and usage.
- **Fix:** Add README (note: this exists, reviewer may have missed it).

## 4. APPROVED

- Plugin architecture: Registration via `registerCompactionProvider` follows expected pattern
- Token estimation: Simple heuristic works for typical English text
- Fallback summarization: Graceful degradation when LLM fails
- Command `/context-stats`: Useful debugging info, uses same token logic
- OpenClaw config schema: Comprehensive with sensible defaults
- Test coverage: Basic unit tests present, demonstrates quality intent