// Token estimator – simple characters-per-token heuristic
export function estimateTokens(text: string, charsPerToken: number): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / charsPerToken));
}

export function estimateMessagesTokens(messages: { content: string }[], charsPerToken: number): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content, charsPerToken), 0);
}
