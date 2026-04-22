# Compakt Code Review - Cross-Reference Summary

**Date:** 2026-04-20
**Reviewers:** kimi-k2.5:cloud, qwen3.5:cloud, minimax-m2.7:cloud, gpt-oss:120b-cloud, nemotron-3-super:cloud

---

## CRITICAL Issues (must fix before testing)

### 1. Syntax Error in Summarizer (Kimi only)
**File:** `src/summarizer.ts` line 59
**Issue:** Incomplete ternary - missing `: fallback` else clause
```typescript
accumulatedSummary = accumulatedSummary ? `${accumulatedSummary}\n\n${fallback}`;
// Missing: : fallback
```
**Consensus:** Found by Kimi only. Verified - this is a real syntax error.
**Priority:** BLOCKER - code won't parse.

### 2. Overlap Calculation Bug (Qwen, MiniMax, Nemotron)
**File:** `src/chunker.ts`
**Issue:** `startIdx = Math.max(startIdx + 1, overlapIdx + 1)` can skip messages or cause infinite loops.
**Consensus:** Found by 3/5 reviewers (Qwen I3, MiniMax C2, Nemotron I3).
**Priority:** HIGH - silent data loss per chunk boundary.

### 3. CLI NaN Input (Qwen C1, MiniMax C1, GPT-OSS C4)
**File:** `cli.js`
**Issue:** `Number()` on user input without validation. `NaN` propagates to config.
**Consensus:** Found by 3/5 reviewers.
**Priority:** HIGH - crashes downstream.

### 4. `enabled` Flag Ignored (GPT-OSS C3)
**File:** `src/index.ts`
**Issue:** Plugin registers CompactionProvider unconditionally, ignoring `enabled` config.
**Consensus:** Found by GPT-OSS only.
**Priority:** HIGH - user can't disable plugin.

### 5. `previousSummary` Never Used (MiniMax C4)
**File:** `src/summarizer.ts`
**Issue:** Parameter accepted but never injected into chunk prompts. Each chunk summarized independently.
**Consensus:** Found by MiniMax only.
**Priority:** HIGH - feature not working as designed.

### 6. `summarizationInstructions` Dropped (MiniMax C3)
**File:** `src/summarizer.ts`
**Issue:** Parameter accepted but never used in prompt template.
**Consensus:** Found by MiniMax only.
**Priority:** HIGH - feature not working.

---

## IMPORTANT Issues (should fix)

### 1. Empty Messages Returns `[[]]` (Qwen I1, GPT-OSS I6, MiniMax I1)
**File:** `src/chunker.ts`
**Issue:** Returns one empty chunk instead of zero chunks.
**Consensus:** 3/5 reviewers.

### 2. AbortSignal Not Checked Between Chunks (Kimi I4, Qwen C4, GPT-OSS I7, MiniMax C5, Nemotron I2)
**File:** `src/summarizer.ts`
**Issue:** Signal passed to LLM call but not checked before each chunk iteration.
**Consensus:** 5/5 reviewers - unanimous.

### 3. Input Validation Missing on Numeric Config (Qwen C2, MiniMax I6)
**File:** `src/commands.ts`, `openclaw.plugin.json`
**Issue:** No `minimum` validation for `charsPerToken`, `chunkContextWindow`, `chunkOverlap`.
**Consensus:** 2/5 reviewers.

### 4. Config Schema Required vs Defaults Mismatch (Qwen I5, GPT-OSS I10, MiniMax N17)
**File:** `openclaw.plugin.json`
**Issue:** All fields marked `required` but have `default` values.
**Consensus:** 3/5 reviewers.

### 5. Fallback Summary Truncation (Kimi C1, MiniMax I8)
**File:** `src/summarizer.ts`
**Issue:** `...` appended even when content < 200 chars, no logging on error.
**Consensus:** 2/5 reviewers.

### 6. Fallback Clarity Missing (Nemotron I1)
**File:** `src/summarizer.ts`
**Issue:** When LLM fails, fallback output has no marker to distinguish from actual summaries.
**Consensus:** 1/5 (unique to Nemotron).
**Fix:** Add `[FALLBACK]` prefix to degraded output.

---

## Test Failures

### 1. Emoji Token Count Test (GPT-OSS C1, Qwen N6)
**File:** `tests/index.test.ts`
**Issue:** Test expects `estimateTokens('😀😀😀', 4) === 1` but emoji is 6 chars (2 UTF-16 each), so result is 2.
**Fix:** Change test expectation to 2.

### 2. Overlap Test Brittle (GPT-OSS C2, Qwen I3)
**File:** `tests/index.test.ts`
**Issue:** Test assumes exact message equality for overlap, but overlap works on tokens, not messages.
**Fix:** Test for overlapping content presence, not exact message equality.

---

## NITPICKS (minor improvements)

| Issue | Files | Count |
|-------|-------|-------|
| Heavy use of `any` types | index.ts, chunker.ts, summarizer.ts, commands.ts | 5/5 |
| Magic numbers without explanation | chunker.ts (SAFETY_MARGIN, OVERHEAD) | 3/5 |
| `logLevel` config defined but unused | index.ts, summarizer.ts | 2/5 |
| CLI prompts not trimmed | cli.js | 2/5 |
| CLI backup collision risk | cli.js (Date.now) | 2/5 |
| CLI partial config update drops fields | cli.js | 1/5 |
| `main` points to TypeScript | package.json | 1/5 |

---

## APPROVED (unanimous)

- CompactionProvider interface implementation correct
- Token estimation math correct (chars÷token heuristic)
- Fallback strategy concept correct
- Config schema structure follows conventions
- No hardcoded credentials
- Safe path handling in CLI
- Test coverage intent present

---

## Priority Fix Order

1. **Syntax error** (summarizer.ts line 59) - BLOCKER
2. **Overlap calculation bug** (chunker.ts) - data loss
3. **previousSummary not used** (summarizer.ts) - feature broken
4. **summarizationInstructions dropped** (summarizer.ts) - feature broken
5. **enabled flag ignored** (index.ts) - can't disable
6. **CLI NaN validation** (cli.js) - crashes
7. **Empty messages edge case** (chunker.ts)
8. **AbortSignal between chunks** (summarizer.ts) - 5/5 reviewers
9. **Test fixes** (tests/index.test.ts)