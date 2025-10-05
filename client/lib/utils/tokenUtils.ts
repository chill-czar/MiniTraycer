// lib/utils/tokenUtils.ts
// Accurate token estimation for Llama models (GPT-2 tokenizer approximation)
export const estimateTokens = (text: string): number => {
  if (!text) return 0;

  // Average: ~1 token per 3.5 characters for English text
  const charEstimate = Math.ceil(text.length / 3.5);

  // Adjust for spaces, punctuation, special chars
  const spaceCount = (text.match(/\s/g) || []).length;
  const specialChars = (text.match(/[^\w\s]/g) || []).length;

  return Math.ceil(charEstimate + spaceCount * 0.3 + specialChars * 0.5);
};

export const estimateMessagesTokens = (
  messages: Array<{ role: string; content: string }>
): number => {
  const contentTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  // Add overhead: ~4 tokens per message for role/formatting
  const overhead = messages.length * 4;

  return contentTokens + overhead;
};

export const truncateToTokenLimit = (
  text: string,
  maxTokens: number
): string => {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) return text;

  // Calculate approximate character limit
  const ratio = maxTokens / estimatedTokens;
  const charLimit = Math.floor(text.length * ratio * 0.95); // 5% safety margin

  return text.substring(0, charLimit) + "...";
};

export const extractTextContent = (content: unknown): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : c?.text || ""))
      .join("");
  }
  if (typeof content === "object" && "text" in content) {
    return String(content.text);
  }
  return String(content);
};
