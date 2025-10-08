// lib/utils/contextManager.ts - OPTIMIZED WITH LOGGING
import { ChatMessage } from "@/types/domain";
import { LLMInvoker } from "./llmInvoker";
import { Logger } from "./logger";

const logger = Logger.getInstance();

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

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  /**
   * Truncate text to token limit
   */
  private truncateToTokenLimit = (text: string, maxTokens: number): string => {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    const targetLength = Math.floor(maxTokens * 4 * 0.9); // 90% to be safe
    return text.slice(0, targetLength);
  };

  /**
   * Build context from prompt and history with intelligent summarization
   */
  buildContext = (
    prompt: string,
    history: ChatMessage[]
  ): { context: string; estimatedTokens: number } => {
    logger.logContext("Building context", {
      promptLength: prompt.length,
      historyLength: history.length,
    });

    const parts: string[] = [];

    // Include last 5 messages for immediate context
    const recentHistory = history.slice(-5);

    recentHistory.forEach((msg) => {
      const content =
        msg.role === "assistant" && msg.summary ? msg.summary : msg.content;
      parts.push(`${msg.role === "user" ? "User" : "Assistant"}: ${content}`);
    });

    parts.push(`User: ${prompt}`);

    const context = parts.join("\n\n");
    const tokens = this.estimateTokens(context);

    logger.logContext("Context built", {
      contextLength: context.length,
      estimatedTokens: tokens,
      messagesIncluded: recentHistory.length,
    });

    return { context, estimatedTokens: tokens };
  };

  /**
   * Generate summary using LLM with dynamic prompt
   */
  generateSummary = async (planMarkdown: string): Promise<string> => {
    logger.logContext("Generating summary", {
      contentLength: planMarkdown.length,
    });

    try {
      const truncated = this.truncateToTokenLimit(planMarkdown, 3000);

      // Fully dynamic summarization prompt
      const summaryPrompt = `You are summarizing a project plan. Create a concise 2-3 sentence summary that captures:
1. The main purpose/goal of the project
2. Key technologies being used
3. The overall scope or deliverables

Content to summarize:
${truncated}

Generate ONLY the summary (no additional commentary):`;

      logger.logLLMCall("Summary generation", {
        truncatedLength: truncated.length,
      });

      const result = await this.llmInvoker.invoke({
        messages: [
          {
            role: "system",
            content: "You are a concise technical summarization expert.",
          },
          { role: "user", content: summaryPrompt },
        ],
        temperature: 0.1,
        maxTokens: 300,
      });

      logger.logLLMResponse("Summary generated", {
        summaryLength: result.content.length,
        tokensUsed: result.tokensUsed,
      });

      return result.content.trim();
    } catch (error) {
      logger.logContext("Summary generation failed, using fallback", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Intelligent fallback: Extract key information
      const lines = planMarkdown.split("\n").filter((l) => l.trim());
      const keyLines = lines.filter(
        (l) =>
          l.startsWith("#") ||
          l.includes("Tech Stack") ||
          l.includes("Architecture") ||
          l.includes("Overview") ||
          l.includes("**") ||
          l.includes("Type:")
      );

      const fallbackSummary = keyLines.slice(0, 8).join("\n").substring(0, 400);

      logger.logContext("Fallback summary created", {
        length: fallbackSummary.length,
      });

      return fallbackSummary;
    }
  };

  /**
   * Compress conversation history intelligently
   */
  compressContext = (
    history: ChatMessage[],
    maxTokens: number = 8000
  ): ChatMessage[] => {
    logger.logContext("Compressing context", {
      originalLength: history.length,
      maxTokens,
    });

    const totalTokens = history.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.summary || msg.content),
      0
    );

    if (totalTokens <= maxTokens) {
      logger.logContext("No compression needed", { totalTokens });
      return history;
    }

    // Use summaries for assistant messages, keep user messages
    const compressed = history.map((msg) => ({
      ...msg,
      content:
        msg.role === "assistant" && msg.summary ? msg.summary : msg.content,
    }));

    const compressedTokens = compressed.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.content),
      0
    );

    logger.logContext("Context compressed", {
      originalTokens: totalTokens,
      compressedTokens,
      reduction: `${Math.round(
        ((totalTokens - compressedTokens) / totalTokens) * 100
      )}%`,
    });

    return compressed;
  };

  /**
   * Extract key information from text
   */
  extractKeyInfo = (text: string, maxLength: number = 500): string => {
    logger.logContext("Extracting key information", {
      textLength: text.length,
      maxLength,
    });

    const lines = text.split("\n").filter((l) => l.trim());

    // Prioritize headers and important markers
    const importantLines = lines.filter(
      (l) =>
        l.startsWith("#") ||
        l.startsWith("**") ||
        l.includes(":") ||
        l.length > 50
    );

    const result = importantLines.join("\n");
    const extracted =
      result.length > maxLength ? result.slice(0, maxLength) + "..." : result;

    logger.logContext("Key information extracted", {
      originalLines: lines.length,
      extractedLines: importantLines.length,
      extractedLength: extracted.length,
    });

    return extracted;
  };

  /**
   * Build progressive context for section generation
   * Maintains continuity while managing token limits
   */
  buildProgressiveContext = (
    previousSections: { title: string; content: string }[],
    maxContextTokens: number = 2000
  ): string => {
    logger.logContext("Building progressive context", {
      sectionCount: previousSections.length,
      maxContextTokens,
    });

    if (previousSections.length === 0) {
      return "No previous sections.";
    }

    // Recent sections get more detail, older sections get summaries
    const contextParts: string[] = [];
    let currentTokens = 0;

    // Start from most recent
    for (let i = previousSections.length - 1; i >= 0; i--) {
      const section = previousSections[i];
      const isRecent = i >= previousSections.length - 2; // Last 2 sections

      const preview = isRecent
        ? section.content.slice(0, 500)
        : section.content.slice(0, 200);

      const sectionContext = `### ${section.title}\n${preview}${
        section.content.length > preview.length ? "..." : ""
      }`;
      const sectionTokens = this.estimateTokens(sectionContext);

      if (currentTokens + sectionTokens > maxContextTokens) {
        // Add just the title for older sections
        const titleOnly = `### ${section.title}\n[Content omitted for brevity]`;
        contextParts.unshift(titleOnly);
        break;
      }

      contextParts.unshift(sectionContext);
      currentTokens += sectionTokens;
    }

    const result = contextParts.join("\n\n");

    logger.logContext("Progressive context built", {
      contextLength: result.length,
      estimatedTokens: currentTokens,
      sectionsIncluded: contextParts.length,
    });

    return result;
  };
}
