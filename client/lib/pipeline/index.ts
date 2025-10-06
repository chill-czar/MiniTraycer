// lib/pipeline/index.ts - FULLY OPTIMIZED
import { StateGraph, END } from "@langchain/langgraph";
import { PipelineStateAnnotation, PipelineState } from "./state";
import {
  initialAnalysisNode,
  classificationNode,
  clarificationNode,
  generalResponseNode,
  chatbotResponseNode,
  sectionPlanningNode,
  sectionGeneratorNode,
  planAggregatorNode,
  retryHandlerNode,
} from "./nodes";
import {
  afterInitialAnalysis,
  afterClassification,
  afterClarification,
  afterGeneralResponse,
  afterChatbotResponse,
  afterSectionPlanning,
  afterSectionGenerator,
  afterPlanAggregator,
  afterRetry,
} from "./routing";
import { ModelManager } from "../utils/modelManager";
import { GeneratePlanRequest, GeneratePlanResponse } from "@/types/api";
import { PlanData, ProjectCategory } from "@/types/domain";

/**
 * Helper to convert promptType to ProjectCategory
 */
const mapPromptTypeToCategory = (promptType?: string): ProjectCategory => {
  switch (promptType) {
    case "builder":
      return "web_app";
    case "general":
      return "utility";
    case "chatbot":
      return "utility";
    case "unclear":
      return "unknown";
    default:
      return "unknown";
  }
};

/**
 * Centralized function to create initial state
 * Prevents duplication between runPipeline and runPipelineStream
 */
const createInitialState = (prompt: string, history: any[]): PipelineState => {
  return {
    userPrompt: prompt,
    history,
    promptType: undefined,
    intentConfidence: undefined,
    detectedIntent: undefined,
    needsClarification: false,
    clarificationQuestions: [],
    clarifiedPrompt: undefined,
    contextSummary: null,
    estimatedTokens: 0,
    conversationContext: undefined,
    sections: undefined,
    generatedSections: new Set<string>(),
    planSections: [],
    finalPlan: null,
    planSummary: null,
    finalResponse: undefined,
    responseMetadata: undefined,
    toolsUsed: [],
    toolResults: undefined,
    projectCategory: undefined,
    detectedTechStack: [],
    suggestedTechStack: [],
    projectComplexity: "moderate",
    currentThinking: null,
    thinkingHistory: [],
    modelUsed: "",
    totalTokensUsed: 0,
    retryCount: 0,
    maxRetries: 3,
    lastError: null,
    failedNode: null,
    stepCount: 0,
    maxSteps: 50,
  };
};

/**
 * Centralized terminal state checker
 */
const isTerminalState = (state: PipelineState): boolean => {
  return !!(
    state.finalResponse ||
    state.finalPlan ||
    state.needsClarification ||
    (state.lastError && state.retryCount > state.maxRetries) ||
    state.stepCount >= state.maxSteps
  );
};

/**
 * Build the dynamic LangGraph workflow - OPTIMIZED
 * All optimizations applied:
 * - Step count increments in nodes
 * - Context summarization
 * - Cached classification
 * - Proper section appending
 * - Retry logic integrated
 */
const workflow = new StateGraph(PipelineStateAnnotation)
  .addNode("initialAnalysisNode", initialAnalysisNode)
  .addNode("classificationNode", classificationNode)
  .addNode("clarificationNode", clarificationNode)
  .addNode("generalResponseNode", generalResponseNode)
  .addNode("chatbotResponseNode", chatbotResponseNode)
  .addNode("sectionPlanningNode", sectionPlanningNode)
  .addNode("sectionGeneratorNode", sectionGeneratorNode)
  .addNode("planAggregatorNode", planAggregatorNode)
  .addNode("retryHandlerNode", retryHandlerNode)
  .addEdge("__start__", "initialAnalysisNode")
  .addConditionalEdges("initialAnalysisNode", afterInitialAnalysis)
  .addConditionalEdges("classificationNode", afterClassification)
  .addConditionalEdges("clarificationNode", afterClarification)
  .addConditionalEdges("generalResponseNode", afterGeneralResponse)
  .addConditionalEdges("chatbotResponseNode", afterChatbotResponse)
  .addConditionalEdges("sectionPlanningNode", afterSectionPlanning)
  .addConditionalEdges("sectionGeneratorNode", afterSectionGenerator)
  .addConditionalEdges("planAggregatorNode", afterPlanAggregator)
  .addConditionalEdges("retryHandlerNode", afterRetry);

const app = workflow.compile();

/**
 * Main pipeline execution - OPTIMIZED
 */
export const runPipeline = async (
  req: GeneratePlanRequest
): Promise<GeneratePlanResponse> => {
  const { prompt, history = [] } = req;

  // Validate request before processing
  const validation = validatePipelineRequest(req);
  if (!validation.valid) {
    return {
      success: false,
      data: null,
      message: validation.error || "Invalid request",
    };
  }

  const modelManager = ModelManager.getInstance();
  await modelManager.initialize();

  const initialState = createInitialState(prompt, history);

  try {
    console.log(
      `[Pipeline] Starting execution for prompt: "${prompt.slice(0, 50)}..."`
    );
    const startTime = Date.now();

    const result = await app.invoke(initialState);

    const executionTime = Date.now() - startTime;
    console.log(
      `[Pipeline] Completed in ${executionTime}ms, ${result.stepCount} steps, ${result.totalTokensUsed} tokens`
    );

    // Handle clarification request
    if (result.needsClarification && result.clarificationQuestions.length > 0) {
      const questions = result.clarificationQuestions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");

      return {
        success: false,
        data: null,
        message: `I need more information to help you better:\n\n${questions}\n\nPlease provide additional details.`,
        needsClarification: true,
      };
    }

    // Handle general or chatbot responses
    if (result.finalResponse) {
      const category = result.projectCategory
        ? (result.projectCategory as ProjectCategory)
        : mapPromptTypeToCategory(result.promptType);

      const responseData: PlanData = {
        markdown: result.finalResponse,
        summary:
          result.finalResponse.length > 200
            ? result.finalResponse.slice(0, 200) + "..."
            : result.finalResponse,
        metadata: {
          generated_at: new Date().toISOString(),
          classification: category,
          model_used: result.modelUsed,
          total_tokens: result.totalTokensUsed,
          summary: result.responseMetadata?.responseType || "response",
        },
      };

      console.log(`[Pipeline] Response generated (${result.promptType} flow)`);
      return {
        success: true,
        data: responseData,
        message: "Response generated successfully",
      };
    }

    // Handle builder flow (plan generation)
    if (result.finalPlan) {
      const category = result.projectCategory
        ? (result.projectCategory as ProjectCategory)
        : mapPromptTypeToCategory(result.promptType);

      const planData: PlanData = {
        markdown: result.finalPlan,
        summary: result.planSummary || "Plan summary not available",
        metadata: {
          generated_at: new Date().toISOString(),
          classification: category,
          model_used: result.modelUsed,
          total_tokens: result.totalTokensUsed,
          summary: result.planSummary || "",
        },
      };

      console.log(
        `[Pipeline] Plan generated with ${result.planSections.length} sections`
      );
      return {
        success: true,
        data: planData,
        message: "Plan generated successfully",
      };
    }

    // Handle failures
    if (result.lastError) {
      let errorMessage = "Failed to process your request. ";

      if (result.retryCount > result.maxRetries) {
        errorMessage += `Maximum retry attempts (${result.maxRetries}) exceeded. `;
      }
      if (result.stepCount >= result.maxSteps) {
        errorMessage += `Maximum processing steps (${result.maxSteps}) exceeded. `;
      }

      errorMessage += `Error: ${result.lastError}`;

      console.error(
        `[Pipeline] Failed at step ${result.stepCount}: ${result.lastError}`
      );
      return {
        success: false,
        data: null,
        message: errorMessage,
      };
    }

    // Fallback - should rarely reach here
    console.warn(`[Pipeline] Completed but no output generated. State:`, {
      promptType: result.promptType,
      stepCount: result.stepCount,
      hasResponse: !!result.finalResponse,
      hasPlan: !!result.finalPlan,
    });

    return {
      success: false,
      data: null,
      message:
        "Pipeline completed but no output was generated. Please try rephrasing your request.",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    console.error("[Pipeline] Execution error:", error);

    return {
      success: false,
      data: null,
      message: `Pipeline failed: ${errorMessage}. Please try again.`,
    };
  }
};

/**
 * Streaming execution - OPTIMIZED
 */
export const runPipelineStream = async function* (
  req: GeneratePlanRequest
): AsyncGenerator<Partial<PipelineState>, void, unknown> {
  const { prompt, history = [] } = req;

  const validation = validatePipelineRequest(req);
  if (!validation.valid) {
    yield {
      lastError: validation.error || "Invalid request",
    };
    return;
  }

  const modelManager = ModelManager.getInstance();
  await modelManager.initialize();

  const initialState = createInitialState(prompt, history);

  try {
    console.log(
      `[Pipeline Stream] Starting for prompt: "${prompt.slice(0, 50)}..."`
    );

    const stream = await app.stream(initialState);

    for await (const chunk of stream) {
      const nodeKeys = Object.keys(chunk) as Array<keyof typeof chunk>;
      if (nodeKeys.length > 0) {
        const firstKey = nodeKeys[0];
        const nodeUpdate = chunk[firstKey];
        if (nodeUpdate) {
          // Log progress
          console.log(
            `[Pipeline Stream] Node: ${firstKey}, Step: ${
              nodeUpdate.stepCount || 0
            }`
          );
          yield nodeUpdate;
        }
      }
    }

    console.log(`[Pipeline Stream] Completed`);
  } catch (error) {
    console.error("[Pipeline Stream] Error:", error);
    yield {
      lastError: error instanceof Error ? error.message : "Stream failed",
    };
  }
};

/**
 * Validation function - OPTIMIZED
 */
export const validatePipelineRequest = (
  req: GeneratePlanRequest
): { valid: boolean; error?: string } => {
  if (!req.prompt || req.prompt.trim().length === 0) {
    return { valid: false, error: "Prompt cannot be empty" };
  }

  if (req.prompt.length > 10000) {
    return {
      valid: false,
      error: "Prompt exceeds maximum length (10000 characters)",
    };
  }

  if (req.history && req.history.length > 50) {
    return {
      valid: false,
      error: "History exceeds maximum length (50 messages)",
    };
  }

  return { valid: true };
};

/**
 * Utility: Get pipeline statistics
 */
export const getPipelineStats = (state: PipelineState) => {
  return {
    totalSteps: state.stepCount,
    totalTokens: state.totalTokensUsed,
    retries: state.retryCount,
    promptType: state.promptType,
    sectionsGenerated: state.planSections.length,
    hasError: !!state.lastError,
    isComplete: isTerminalState(state),
  };
};

/**
 * Utility: Reset pipeline state for new conversation
 */
export const resetPipelineState = (
  keepHistory: boolean = false,
  currentState?: PipelineState
) => {
  if (!currentState) {
    return createInitialState("", []);
  }

  return createInitialState("", keepHistory ? currentState.history : []);
};

export { workflow, app, createInitialState, isTerminalState };
