# Compakt Code Review - Qwen3.5

**Model:** ollama/qwen3.5:cloud
**Date:** 2026-04-20

## 1. CRITICAL

### C1. CLI Backup Naming Collision (`cli.js`)
- `backupConfig()` uses `Date.now()` for backup filename which could collide in rapid successive runs.
- **Fix:** Use crypto.randomBytes or UUID for backup naming.

### C2. Missing Input Validation in Config Schema (`openclaw.plugin.json`)
- No `minimum` validation for numeric values. Zero/negative values would break token estimation and chunking.
- **Fix:** Add `"minimum": 1` for `charsPerToken`, `"minimum": 1000` for `chunkContextWindow`, `"minimum": 0` for `chunkOverlap`.

### C3. Unsafe Type Casting (`src/index.ts`, `src/summarizer.ts`, `src/commands.ts`)
- Multiple uses of `any` type. No type safety for OpenClaw API surface.
- **Fix:** Define proper TypeScript interfaces for OpenClaw API, CompactionProvider, and message types.

### C4. Missing AbortSignal Propagation (`src/summarizer.ts`)
- Passes `signal` to LLM call but doesn't check if already aborted before processing chunks.
- **Fix:** Check `signal?.aborted` at start of each chunk iteration and throw/return early.

## 2. IMPORTANT

### I1. Chunking Edge Case: Empty Messages Array (`src/chunker.ts`)
- If `messages` is empty, returns `[[]]` (one empty chunk) instead of `[]` (zero chunks).
- **Fix:** Return `[]` early if `messages.length === 0`.

### I2. Chunking Edge Case: Single Message Exceeds Context (`src/chunker.ts`)
- Single message exceeding `effectiveChunkTokens` still gets added because `endIdx === startIdx` bypasses the break condition.
- **Fix:** Handle oversized messages by truncating or splitting individual message content.

### I3. Overlap Calculation Bug (`src/chunker.ts`)
- `startIdx = Math.max(startIdx + 1, overlapIdx + 1)` could result in `startIdx` not advancing if `overlapIdx + 1 <= startIdx`, causing infinite loops or duplicate chunks.
- **Fix:** Ensure `startIdx` always advances. Consider simpler overlap strategy.

### I4. Fallback Summary Formatting (`src/summarizer.ts`)
- Fallback truncates to 200 chars with `...` but doesn't indicate truncation.
- **Fix:** Add explicit truncation notice: `[TRUNCATED] ${fallback}`.

### I5. Config Schema Required Fields (`openclaw.plugin.json`)
- All fields marked as required, but code uses defaults (`??` operator). Schema/implementation mismatch.
- **Fix:** Make fields optional in schema or ensure required in code.

### I6. Test Coverage Gaps (`tests/index.test.ts`)
- Missing tests for: empty messages, single oversized message, AbortSignal cancellation, config validation, CLI setup.
- **Fix:** Add edge case and error condition tests.

## 3. NITPICKS

### N2. Magic Numbers (`src/chunker.ts`)
- `SAFETY_MARGIN = 1.2`, `OVERHEAD = 4096` hardcoded without explanation.
- **Fix:** Add comments explaining origin or make configurable.

### N3. Inconsistent Error Handling (`src/summarizer.ts`)
- Catches all errors but doesn't log them. Silent failures.
- **Fix:** Use `api.logger?.debug()` to log before fallback.

### N4. CLI process.stdin.once (`cli.js`)
- Uses `once` listener without cleanup. Ctrl+C leaves listener.
- **Fix:** Add signal handling and cleanup.

### N5. Backup Strategy (`cli.js`)
- Creates timestamped backups but never cleans up.
- **Fix:** Keep only last N backups.

### N6. Token Estimation Test for Emoji (`tests/index.test.ts`)
- Test claims `'😀😀😀'` should be 1 token, but 12 bytes / 4 = 3 tokens. Test is incorrect.
- **Fix:** Fix test expectation or clarify intent.

## 4. APPROVED

- CompactionProvider Interface: Correctly implements id, label, summarize
- Provider Registration: Uses optional chaining
- Token Estimator: Simple, efficient character-based heuristic
- Fallback Strategy: Gracefully degrades to raw messages
- Config Schema Structure: Follows JSON Schema conventions
- Package.json Metadata: Complete with links
- Test Structure: Good separation of concerns
- Module Exports: Clean exports