import { estimateTokens } from "./token-estimator.js";

export interface ChunkerOptions {
  messages: any[]; // messages with .content
  charsPerToken: number;
  chunkContextWindow: number; // model context window tokens
  chunkOverlap: number; // tokens overlap between chunks
}

/**
 * Split messages into chunks that fit within the effective context size for the
 * compaction model. Uses a simple greedy algorithm based on token counts.
 */
export function chunkMessages(options: ChunkerOptions): any[][] {
  const { messages, charsPerToken, chunkContextWindow, chunkOverlap } = options;

  // Effective tokens available for actual message content per chunk.
  // We follow the same logic as OpenClaw's built‑in summarizer:
  //   effective = floor(contextWindow / SAFETY_MARGIN) - OVERHEAD
  const SAFETY_MARGIN = 1.2;
  const OVERHEAD = 4096;
  const effectiveChunkTokens = Math.max(1, Math.floor(chunkContextWindow / SAFETY_MARGIN) - OVERHEAD);

  // Quick path – all fit in one chunk
  const totalTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content ?? "", charsPerToken),
    0,
  );
  if (messages.length === 0) return [];
  if (totalTokens <= effectiveChunkTokens) return [messages];

  const chunks: any[][] = [];
  let startIdx = 0;
  while (startIdx < messages.length) {
    let chunkTokens = 0;
    let endIdx = startIdx;
    // Greedily add messages until we exceed the token budget
    while (endIdx < messages.length) {
      const msgTokens = estimateTokens(messages[endIdx].content ?? "", charsPerToken);
      if (chunkTokens + msgTokens > effectiveChunkTokens && endIdx > startIdx) break;
      chunkTokens += msgTokens;
      endIdx++;
    }
    const chunk = messages.slice(startIdx, endIdx);
    chunks.push(chunk);
    // Compute next start index with overlap (by tokens)
    if (endIdx === messages.length) break;
    // Walk backwards from endIdx to include overlap tokens
    let overlapTokens = 0;
    let overlapIdx = endIdx - 1;
    while (overlapIdx >= startIdx && overlapTokens < chunkOverlap) {
      overlapTokens += estimateTokens(messages[overlapIdx].content ?? "", charsPerToken);
      overlapIdx--;
    }
    startIdx = Math.max(startIdx + 1, overlapIdx + 1); // Ensure we move at least one message forward and include overlap correctly
  }
  return chunks;
}
