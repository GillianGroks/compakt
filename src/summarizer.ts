import { estimateTokens } from "./token-estimator.js";


interface SummarizerParams
  extends Partial<{
    messages: any[];
    previousSummary: string;
    signal?: AbortSignal;
    customInstructions?: string;
    summarizationInstructions: any;
    summaryModel: string;
    ollamaBaseUrl: string;
    charsPerToken: number;
    chunkContextWindow: number;
    chunkOverlap: number;
    summaryMaxTokens: number;
    api: any;
  }> {}

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

export async function summarize(params: SummarizerParams): Promise<string> {
  const {
    messages,
    previousSummary,
    signal,
    customInstructions,
    summarizationInstructions,
    summaryModel,
    ollamaBaseUrl = DEFAULT_OLLAMA_URL,
    charsPerToken,
    chunkContextWindow,
    chunkOverlap,
    summaryMaxTokens,
    api,
  } = params;
  
  // Estimate input tokens
  const inputText = messages?.map((m: any) => m.content ?? '').join('\n') ?? '';
  const inputTokens = estimateTokens(inputText, charsPerToken ?? 4);
  const inputChars = inputText.length;
  
  api?.logger?.info?.(`[Compakt.summarize] Called with summaryModel=${summaryModel}, ollamaBaseUrl=${ollamaBaseUrl}, messages=${messages?.length ?? 0}, inputTokens=${inputTokens}, inputChars=${inputChars}`);

  // Lazy‑load chunker to avoid circular deps
  const { chunkMessages } = await import("./chunker.js");
  const chunks = chunkMessages({
    messages: messages ?? [],
    charsPerToken: charsPerToken ?? 4,
    chunkContextWindow: chunkContextWindow ?? 8192,
    chunkOverlap: chunkOverlap ?? 500,
  });

  // Summarize each chunk sequentially (could be parallelized later)
  let accumulatedSummary = previousSummary ?? "";
  for (const chunk of chunks) {
    if (signal?.aborted) {
      // Abort requested; return whatever has been accumulated so far
      return accumulatedSummary.trim();
    }
    const chunkText = chunk.map((m: any) => `[${m.role?.toUpperCase() ?? "MESSAGE"}]: ${m.content}`).join("\n\n");
    let contextPrefix = '';
    if (accumulatedSummary) {
      contextPrefix = `Previous summary:\n${accumulatedSummary}\n\n`;
    }
    let extraInstr = '';
    if (customInstructions) extraInstr = `${customInstructions}\n\n`;
    else if (summarizationInstructions) extraInstr = `${summarizationInstructions}\n\n`;
    const prompt = `Summarize the following conversation chunk concisely, preserving important details and identifiers.\n\n${extraInstr}${contextPrefix}${chunkText}\n\nSUMMARY:`;
    
    try {
      // Guard: summaryModel is required
      if (!summaryModel) {
        throw new Error('[Compakt] summaryModel is required but not provided');
      }
      
      // Parse model string (e.g., "ollama/qwen3.5-compaction-32k" -> provider="ollama", model="qwen3.5-compaction-32k")
      const [provider, modelName] = summaryModel.includes('/')
        ? summaryModel.split('/')
        : ['ollama', summaryModel];

      let chunkSummary: string | undefined;

      // For Ollama, use direct HTTP API (much simpler than runEmbeddedPiAgent)
      if (provider === 'ollama') {
        api?.logger?.info?.(`[Compakt] Calling Ollama API: ${ollamaBaseUrl}/api/generate with model=${modelName}`);
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
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        chunkSummary = (data as { response?: string }).response?.trim();
      } else {
        // Non-Ollama providers not yet supported - log warning and use fallback
        api.logger?.warn?.(`[Compakt] Non-Ollama provider "${provider}" not yet supported for summarization`);
      }

      if (chunkSummary) {
        accumulatedSummary = accumulatedSummary ? `${accumulatedSummary}\n\n${chunkSummary}` : chunkSummary;
      }
    } catch (err) {
      // Fallback: include raw messages if summarization fails
      const fallback = chunk.map((m: any) => `${m.role}: ${m.content.slice(0, 200)}...`).join("\n");
      accumulatedSummary = accumulatedSummary ? `${accumulatedSummary}\n\n[FALLBACK] ${fallback}` : `[FALLBACK] ${fallback}`;
    }
  }
  
  // Log compression stats
  const outputTokens = estimateTokens(accumulatedSummary, charsPerToken ?? 4);
  const outputChars = accumulatedSummary.length;
  const compressionRatio = inputTokens > 0 ? ((1 - outputTokens / inputTokens) * 100).toFixed(1) : 'N/A';
  api?.logger?.info?.(`[Compakt.summarize] Complete: outputTokens=${outputTokens}, outputChars=${outputChars}, compression=${compressionRatio}% (${inputTokens} → ${outputTokens} tokens)`);
  
  return accumulatedSummary.trim();
}