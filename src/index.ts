import { summarize } from "./summarizer.js";

const COMPACTION_PROVIDER_REGISTRY_STATE = Symbol.for("openclaw.compactionProviderRegistryState");

export const id = "compakt";
export const label = "Compakt Context Compactor";

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

export function register(api: any) {
  api.logger?.info?.(`[Compakt] register() called, plugin ID: ${id}`);
  const cfg = api.config?.plugins?.entries?.[id]?.config ?? {};
  api.logger?.info?.(`[Compakt] Config loaded: enabled=${cfg.enabled}, summaryModel=${cfg.summaryModel}`);
  if (cfg.enabled === false) {
    api.logger?.warn?.(`[Compakt] Plugin is explicitly disabled in config`);
    return;
  }

  const summaryModel = cfg.summaryModel;
  if (!summaryModel) {
    api.logger?.error?.(
      "[Compakt] summaryModel is required. Please configure it in openclaw.json under plugins.entries.compakt.config.summaryModel"
    );
    return;
  }
  api.logger?.info?.(`[Compakt] summaryModel=${summaryModel}, registering provider...`);

  // Resolve Ollama base URL: env var takes precedence over config
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || cfg.ollamaBaseUrl || DEFAULT_OLLAMA_URL;

  const provider = {
    id,
    label,
    async summarize(params: any) {
      // params includes messages, signal, compressionRatio, customInstructions, summarizationInstructions, previousSummary
      const charsPerToken = cfg.charsPerToken ?? 4;
      const chunkContextWindow = cfg.chunkContextWindow ?? 8192;
      const chunkOverlap = cfg.chunkOverlap ?? 500;
      const summaryMaxTokens = cfg.summaryMaxTokens ?? 1000;

      // Summarize using our helper which handles chunking and fallback
      return await summarize({
        messages: params.messages,
        previousSummary: params.previousSummary,
        signal: params.signal,
        customInstructions: params.customInstructions,
        summarizationInstructions: params.summarizationInstructions,
        summaryModel,
        ollamaBaseUrl,
        charsPerToken,
        chunkContextWindow,
        chunkOverlap,
        summaryMaxTokens,
        api,
      });
    },
  };

  // Direct registration bypasses timing issues
  const globalState = (globalThis as any);
  if (!globalState[COMPACTION_PROVIDER_REGISTRY_STATE]) {
    globalState[COMPACTION_PROVIDER_REGISTRY_STATE] = { providers: new Map() };
  }
  globalState[COMPACTION_PROVIDER_REGISTRY_STATE].providers.set("compakt", {
    provider,
    ownerPluginId: "compakt"
  });

  // Register with OpenClaw
  api.logger?.info?.(`[Compakt] Calling api.registerCompactionProvider with id="${provider.id}"`);
  api.registerCompactionProvider?.(provider);
  api.logger?.info?.(`[Compakt] Registration complete`);
}