import { estimateTokens } from "./token-estimator.js";
import { chunkMessages } from "./chunker.js";

/**
 * Register the `/context-stats` command which reports current token estimate,
 * number of chunks, and the compaction model in use.
 */
export function register(api: any) {
  if (!api?.registerCommand) return;

  api.registerCommand({
    name: "/context-stats",
    description: "Show token estimate, chunk count and compaction model for the current session",
    // Handler receives the current conversation messages via ctx.messages
    handler: async (args: any, ctx: any) => {
      const messages = ctx?.messages ?? [];
      const cfg = api.config?.plugins?.entries?.compakt?.config ?? {};
      const charsPerToken = cfg.charsPerToken ?? 4;
      const chunkContextWindow = cfg.chunkContextWindow ?? 32768;
      const chunkOverlap = cfg.chunkOverlap ?? 500;
      const summaryModel = cfg.summaryModel ?? "ollama/qwen3.5-compaction";

      const tokenCount = estimateTokens(messages.map((m: any) => m.content ?? "").join(""), charsPerToken);
      const chunks = chunkMessages({
        messages,
        charsPerToken,
        chunkContextWindow,
        chunkOverlap,
      });

      const reply = `⚙️ Compakt stats:
- Model: ${summaryModel}
- Estimated tokens (all messages): ${tokenCount}
- Chunk count: ${chunks.length}`;
      // Send the reply back to the user – API surface may vary; using `api.sendMessage` if available
      if (api.sendMessage) {
        await api.sendMessage({ role: "assistant", content: reply }, ctx);
      } else if (ctx?.send) {
        await ctx.send(reply);
      }
    },
  });
}
