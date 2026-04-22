import { estimateTokens } from "../src/token-estimator.js";
import { chunkMessages } from "../src/chunker.js";
import { summarize } from "../src/summarizer.js";

// Simple test runner – runs when executed with `node --test`

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Token estimator tests
function testEstimateTokens() {
  assert(estimateTokens('', 4) === 0, 'empty string should be 0');
  assert(estimateTokens('hello', 4) === 2, 'hello (5 chars) -> 2 tokens');
  assert(estimateTokens('😀😀😀', 4) === 2, 'emoji count');
}

// Chunker tests
function testChunkerSingle() {
  const msgs = [{ content: 'a'.repeat(100) }];
  const chunks = chunkMessages({
    messages: msgs,
    charsPerToken: 4,
    chunkContextWindow: 5000,
    chunkOverlap: 100,
  });
  assert(chunks.length === 1, 'single chunk expected');
}

function testChunkerMultiple() {
  const msgs = [];
  for (let i = 0; i < 20; i++) {
    msgs.push({ content: 'msg' + i });
  }
  const chunks = chunkMessages({
    messages: msgs,
    charsPerToken: 4,
    chunkContextWindow: 200,
    chunkOverlap: 20,
  });
  assert(chunks.length > 1, 'multiple chunks expected');
}

function testChunkerOverlap() {
  const msgs = [];
  for (let i = 0; i < 5; i++) {
    msgs.push({ content: 'x'.repeat(100) });
  }
  const chunks = chunkMessages({
    messages: msgs,
    charsPerToken: 4,
    chunkContextWindow: 300,
    chunkOverlap: 50,
  });
  // Ensure overlap tokens are present in consecutive chunks
  const first = chunks[0];
  const second = chunks[1];
  // compare token count of overlap region
  const overlapTokensFirst = estimateTokens(first.slice(-1)[0].content, 4);
  const overlapTokensSecond = estimateTokens(second[0].content, 4);
  assert(overlapTokensFirst === overlapTokensSecond, 'overlap token count should match');
}

// Summarizer fallback test – simulate API failure by mocking api.runtime.llm.complete
async function testSummarizerFallback() {
  const fakeApi = {
    runtime: { llm: { complete: () => { throw new Error('LLM failed'); } } },
  } as any;
  const summary = await summarize({
    messages: [
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hi there' },
    ],
    summaryModel: 'invalid-model',
    charsPerToken: 4,
    chunkContextWindow: 5000,
    chunkOverlap: 100,
    summaryMaxTokens: 100,
    api: fakeApi,
  });
  assert(summary.includes('Hello world') && summary.includes('Hi there'), 'fallback should include raw messages');
}

async function runAll() {
  testEstimateTokens();
  testChunkerSingle();
  testChunkerMultiple();
  testChunkerOverlap();
  await testSummarizerFallback();
  console.log('All tests passed');
}

runAll();
