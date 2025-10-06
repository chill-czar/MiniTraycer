// lib/utils/contextManager.ts
import { ChatMessage } from "@/types/domain";
import { estimateTokens, truncateToTokenLimit } from "./tokenUtils";
import { LLMInvoker } from "./llmInvoker";
import { PROMPTS } from "./prompts";

export class ContextManager {
  private static instance: ContextManager;
  private llmInvoker = new LLMInvoker();

  private constructor() {}

  static getInstance = () => {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  };

  buildContext = (
    prompt: string,
    history: ChatMessage[]
  ): { context: string; estimatedTokens: number } => {
    const parts: string[] = [];

    history.forEach((msg) => {
      const content =
        msg.role === "assistant" && msg.summary ? msg.summary : msg.content;
      parts.push(`${msg.role === "user" ? "User" : "Assistant"}: ${content}`);
    });

    parts.push(`User: ${prompt}`);

    const context = parts.join("\n\n");
    const tokens = estimateTokens(context);

    return { context, estimatedTokens: tokens };
  };

  generateSummary = async (planMarkdown: string): Promise<string> => {
    try {
      const truncated = truncateToTokenLimit(planMarkdown, 3000);

      const result = await this.llmInvoker.invoke({
        messages: [
          { role: "system", content: PROMPTS.SUMMARIZE },
          { role: "user", content: truncated },
        ],
        temperature: 0.1,
        maxTokens: 300,
      });

      return result.content.trim();
    } catch {

      const lines = planMarkdown.split("\n").filter((l) => l.trim());
      const keyLines = lines.filter(
        (l) =>
          l.startsWith("#") ||
          l.includes("Tech Stack") ||
          l.includes("Architecture")
      );

      return keyLines.slice(0, 8).join("\n").substring(0, 400);
    }
  };

  compressContext = (
    history: ChatMessage[],
    maxTokens: number = 8000
  ): ChatMessage[] => {
    const totalTokens = history.reduce(
      (sum, msg) => sum + estimateTokens(msg.summary || msg.content),
      0
    );

    if (totalTokens <= maxTokens) return history;

    return history.map((msg) => ({
      ...msg,
      content:
        msg.role === "assistant" && msg.summary ? msg.summary : msg.content,
    }));
  };
}
