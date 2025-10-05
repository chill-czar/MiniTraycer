// lib/utils/llmInvoker.ts
import { ChatGroq } from "@langchain/groq";
import { ModelManager } from "./modelManager";
import {
  estimateMessagesTokens,
  extractTextContent,
  estimateTokens,
} from "./tokenUtils";
import { LLMInvokeOptions, LLMInvokeResult } from "@/types/generatePlan";

export class LLMInvoker {
  private modelManager = ModelManager.getInstance();
  private maxAttempts = 3;

  invoke = async (options: LLMInvokeOptions): Promise<LLMInvokeResult> => {
    const estimatedTokens = estimateMessagesTokens(options.messages);
    let currentKey = await this.modelManager.getBestAvailableKey(
      estimatedTokens
    );

    if (!currentKey) {
      throw new Error("No available API keys");
    }

    let attempt = 0;

    while (attempt < this.maxAttempts) {
      attempt++;

      try {
        const result = await this.executeLLMCall(
          currentKey.model,
          currentKey.key,
          options
        );

        await this.modelManager.reportUsage(
          currentKey.model,
          currentKey.key,
          result.tokensUsed
        );

        return {
          ...result,
          modelUsed: currentKey.model,
        };
      } catch {
        
        await this.modelManager.markFailed(currentKey.model, currentKey.key);

        const nextKey = await this.modelManager.getNextKey(
          currentKey.model,
          currentKey.key,
          estimatedTokens
        );

        if (!nextKey) {
          throw new Error("All API keys exhausted");
        }

        currentKey = nextKey;
      }
    }

    throw new Error("Max attempts exceeded");
  };

  private executeLLMCall = async (
    model: string,
    apiKey: string,
    options: LLMInvokeOptions
  ): Promise<{ content: string; tokensUsed: number }> => {
    const llm = new ChatGroq({
      apiKey,
      model,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 3000,
    });

    const response = await llm.invoke(options.messages);
    const content = extractTextContent(response.content);
    const tokensUsed = estimateTokens(content);

    return { content, tokensUsed };
  };
}
