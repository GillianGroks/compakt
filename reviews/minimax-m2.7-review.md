# Compakt Code Review - MiniMax M2.7

**Model:** ollama/minimax-m2.7:cloud
**Date:** 2026-04-20

## 1. CRITICAL

### C1. CLI Writes NaN to Config (`cli.js`)
```js
const chunkContextWindow = Number(await prompt('...'));
```
If user types "abc", `Number("abc")` → `NaN`, written directly to config. Downstream math fails silently.
- **Fix:** Validate numeric inputs before writing.

### C2. Overlap Calculation Off-by-One, Causes Message Skipping (`src/chunker.ts`)
```js
startIdx = Math.max(startIdx + 1, overlapIdx + 1);
```
After computing `overlapIdx` (last message in overlap), `startIdx` is advanced to `overlapIdx + 1`, which skips `overlapIdx` entirely. In typical 5-message case, message at `overlapIdx` is dropped every iteration. Silent data loss.
- **Fix:** Correct the overlap boundary calculation.

### C3. `summarizationInstructions` Parameter Dropped (`src/summarizer.ts`)
Parameter is accepted and passed in but never used in the prompt template. CompactionProvider receives `params.summarizationInstructions` but it has zero effect.
- **Fix:** Include summarization instructions in prompt.

### C4. `previousSummary` Never Injected into Prompt (`src/summarizer.ts`)
```js
let accumulatedSummary = previousSummary ?? "";
// previousSummary never appears in prompt
accumulatedSummary = accumulatedSummary ? `${accumulatedSummary}\n\n${chunkSummary}` : chunkSummary;
```
`previousSummary` accumulates across chunks but never appears in any prompt. Each chunk summarized independently, losing cross-chunk coherence.
- **Fix:** Include previous summary in chunk prompts for sequential summarization.

### C5. AbortSignal Not Propagated to LLM Call (`src/summarizer.ts`)
```js
await api.runtime?.llm?.complete({
  model: summaryModel,
  messages: [...],
  maxTokens: summaryMaxTokens,
  signal,   // ← passed, but is api.runtime.llm.complete abortable?
});
```
No guarantee underlying `complete()` call honors AbortSignal. If LLM SDK ignores it, cancellation is broken.
- **Fix:** Verify AbortSignal support or document limitation.

## 2. IMPORTANT

### I6. Input Validation Missing on Numeric Config (`src/commands.ts`)
```js
const charsPerToken = cfg.charsPerToken ?? 4;
```
`charsPerToken ≤ 0` causes division by zero. Negative `chunkOverlap` breaks overlap logic. Config has no numeric bounds.
- **Fix:** Add range checks for all numeric config values.

### I7. CLI Partial Config Update Drops Other Fields (`cli.js`)
```js
config.plugins.entries.compakt = {
  ...config.plugins.entries.compakt,
  config: { ...compaktConfig, summaryModel, chunkContextWindow, chunkOverlap }
};
```
If user previously set `charsPerToken: 2`, running CLI resets it to default. Silent data loss.
- **Fix:** Preserve all existing config fields, not just the prompted ones.

### I8. Catch Block Ignores Error Type (`src/summarizer.ts`)
```js
} catch (err) {
  const fallback = chunk.map((m: any) => `${m.role}: ${m.content.slice(0, 200)}...`)
}
```
No logging, no re-throw, no distinction between LLM failure vs malformed message. Also, "..." appended even when content < 200 chars (misleading).
- **Fix:** Log error type, only append "..." when actually truncated.

### I9. `effectiveChunkTokens` Can Be Zero or Negative (`src/chunker.ts`)
```js
const effectiveChunkTokens = Math.max(1, Math.floor(chunkContextWindow / SAFETY_MARGIN) - OVERHEAD);
```
With `OVERHEAD = 4096`, even large context windows lose most capacity. `chunkContextWindow = 4096` → `max(1, -683) = 1`. Not a bug but `OVERHEAD` is very conservative.
- **Fix:** Document the overhead constant or make it configurable.

### I10. Chunk Prompt Includes No `previousSummary` (`src/summarizer.ts`)
Sequential chunk summarization without feeding prior summaries means each chunk summarized independently. `previousSummary` parameter exists but never incorporated into prompt.
- **Fix:** For chunks after the first, include previous summary in prompt.

## 3. NITPICKS

### N11. `messages` Parameter Typed as `any[]` (`src/chunker.ts`)
Should be `{ content: string }[]` at minimum.
- **Fix:** Add minimal type.

### N12. `SummarizerParams` Uses `extends Partial` Unnecessarily (`src/summarizer.ts`)
All fields already optional, then destructured with `??` defaults. Could simplify.
- **Fix:** Use plain interface with optionals.

### N13. `register` Function Parameter Typed as `any` (`src/index.ts`)
No type from OpenClaw SDK. If OpenClaw exports plugin API type, use it.
- **Fix:** Import and use proper type.

### N14. No Test for Empty Messages Array (`tests/index.test.ts`)
`chunkMessages` and `summarize` handle empty arrays but no test.
- **Fix:** Add edge case test.

### N15. Imports `summarize` But Never Calls It (`tests/index.test.ts`)
```js
import { summarize } from "./summarizer";
```
Only indirectly tested via `testSummarizerFallback`. Incomplete coverage.
- **Fix:** Add direct `summarize` tests.

### N16. `customInstructions` vs `summarizationInstructions` Naming (`src/summarizer.ts`)
Two similar parameter names with different semantics. Confusing overlap.
- **Fix:** Clarify naming or consolidate.

### N17. `required` Array Includes Fields with Defaults (`openclaw.plugin.json`)
All 7 fields in `required` but have `default` values. Misleading.
- **Fix:** Remove from `required` since defaults provided.

## 4. APPROVED

- `token-estimator.ts`: Math is correct
- `token-estimator.ts`: Simple, single-responsibility, well-named
- `openclaw.plugin.json`: Config schema well-structured
- `package.json`: Metadata clean
- `src/index.ts`: CompactionProvider registration correct
- `src/commands.ts`: Safe config access pattern
- `cli.js`: No shell injection
- Test suite: Core logic covered

## Summary

| Category | Count |
|---|---|
| Critical | 5 |
| Important | 5 |
| Nitpicks | 7 |
| Approved | 8 |

**Bottom line:** Solid foundation, but 5 critical issues block production use. Most critical: overlap skip bug (silent data loss per chunk), NaN input handling, and `previousSummary`/`summarizationInstructions` being accepted but unused.