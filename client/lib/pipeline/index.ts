// lib/pipeline/index.ts
import { StateGraph } from "@langchain/langgraph";
import { PipelineStateAnnotation, PipelineState } from "./state";
import {
  initialAnalysisNode,
  clarificationNode,
  sectionPlanningNode,
  sectionGeneratorNode,
  planAggregatorNode,
  retryHandlerNode,
} from "./nodes";
import {
  afterInitialAnalysis,
  afterClarification,
  afterSectionPlanning,
  afterSectionGenerator,
  afterPlanAggregator,
  afterRetry,
} from "./routing";
import { ModelManager } from "../utils/modelManager";
import {
  GeneratePlanRequest,
  GeneratePlanResponse,
} from "@/types/api";
import { ChatMessage, PlanData } from "@/types/domain";
import { Logger } from "../utils/logger";

const logger = Logger.getInstance();

const createInitialState = (
  prompt: string,
  history: ChatMessage[]
): PipelineState => {
  logger.logFlowStart({
    prompt: prompt.slice(0, 100),
    historyLength: history.length,
    timestamp: new Date().toISOString(),
  });

  return {
    userPrompt: prompt,
    history,
    needsClarification: false,
    clarificationQuestions: [],
    clarifiedPrompt: undefined,
    intentConfidence: undefined,
    contextSummary: null,
    estimatedTokens: 0,
    sections: undefined,
    generatedSections: new Set<string>(),
    planSections: [],
    finalPlan: null,
    planSummary: null,
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

// Build LangGraph workflow with all nodes and conditional edges
const workflow = new StateGraph(PipelineStateAnnotation)
  .addNode("initialAnalysisNode", initialAnalysisNode)
  .addNode("clarificationNode", clarificationNode)
  .addNode("sectionPlanningNode", sectionPlanningNode)
  .addNode("sectionGeneratorNode", sectionGeneratorNode)
  .addNode("planAggregatorNode", planAggregatorNode)
  .addNode("retryHandlerNode", retryHandlerNode)
  .addEdge("__start__", "initialAnalysisNode")
  .addConditionalEdges("initialAnalysisNode", afterInitialAnalysis)
  .addConditionalEdges("clarificationNode", afterClarification)
  .addConditionalEdges("sectionPlanningNode", afterSectionPlanning)
  .addConditionalEdges("sectionGeneratorNode", afterSectionGenerator)
  .addConditionalEdges("planAggregatorNode", afterPlanAggregator)
  .addConditionalEdges("retryHandlerNode", afterRetry);

const app = workflow.compile();

export const validatePipelineRequest = (
  req: GeneratePlanRequest
): { valid: boolean; error?: string } => {
  logger.logValidation("Starting request validation", {
    prompt: req.prompt?.slice(0, 50),
  });

  if (!req.prompt || req.prompt.trim().length === 0) {
    logger.logValidation("Validation failed: Empty prompt");
    return { valid: false, error: "Prompt cannot be empty" };
  }

  if (req.prompt.length > 10000) {
    logger.logValidation("Validation failed: Prompt too long", {
      length: req.prompt.length,
    });
    return {
      valid: false,
      error: "Prompt exceeds maximum length (10000 characters)",
    };
  }

  if (req.history && req.history.length > 50) {
    logger.logValidation("Validation failed: History too long", {
      length: req.history.length,
    });
    return {
      valid: false,
      error: "History exceeds maximum length (50 messages)",
    };
  }

  logger.logValidation("Validation successful");
  return { valid: true };
};

export const runPipeline = async (
  req: GeneratePlanRequest
): Promise<GeneratePlanResponse> => {
  const { prompt, history = [] } = req;
  const executionId = `exec_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  logger.logExecution("Pipeline execution started", {
    executionId,
    promptLength: prompt.length,
    historyLength: history.length,
  });

  const validation = validatePipelineRequest(req);
  if (!validation.valid) {
    logger.logExecution("Pipeline execution failed validation", {
      executionId,
      error: validation.error,
    });
    return {
      success: false,
      data: null,
      message: validation.error || "Invalid request",
    };
  }

  const modelManager = ModelManager.getInstance();
  await modelManager.initialize();
  logger.logExecution("Model manager initialized", { executionId });

  const initialState = createInitialState(prompt, history);

  try {
    const startTime = Date.now();
    logger.logExecution("Starting graph execution", {
      executionId,
      timestamp: new Date().toISOString(),
    });

    const result = await app.invoke(initialState);

    const executionTime = Date.now() - startTime;
    logger.logExecution("Graph execution completed", {
      executionId,
      executionTime,
      stepCount: result.stepCount,
      totalTokensUsed: result.totalTokensUsed,
      finalState: {
        hasPlan: !!result.finalPlan,
        needsClarification: result.needsClarification,
        hasError: !!result.lastError,
      },
    });

    // Return clarification request if needed
    if (result.needsClarification && result.clarificationQuestions.length > 0) {
      logger.logClarification("Returning clarification request", {
        executionId,
        questionCount: result.clarificationQuestions.length,
        questions: result.clarificationQuestions,
      });

      const questions = result.clarificationQuestions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");

      return {
        success: true,
        data: null,
        message: `I need more information to create a comprehensive plan:\n\n${questions}\n\nPlease provide additional details so I can generate the best plan for you.`,
        needsClarification: true,
      };
    }

    // Return successful plan
    if (result.finalPlan) {
      logger.logAggregation("Plan generation successful", {
        executionId,
        planLength: result.finalPlan.length,
        sectionCount: result.planSections.length,
        category: result.projectCategory,
        tokensUsed: result.totalTokensUsed,
      });

      const planData: PlanData = {
        markdown: result.finalPlan,
        summary: result.planSummary || "Comprehensive project plan generated",
        metadata: {
          generated_at: new Date().toISOString(),
          classification: result.projectCategory || "general_project",
          model_used: result.modelUsed,
          total_tokens: result.totalTokensUsed,
          summary: result.planSummary || "",
        },
      };

      logger.logFlowEnd({
        executionId,
        success: true,
        outputLength: result.finalPlan.length,
        totalTime: executionTime,
      });

      return {
        success: true,
        data: planData,
        message: "Plan generated successfully",
      };
    }

    // Handle error cases
    if (result.lastError) {
      logger.logError("Pipeline execution failed", {
        executionId,
        error: result.lastError,
        failedNode: result.failedNode,
        retryCount: result.retryCount,
        stepCount: result.stepCount,
      });

      let errorMessage = "Failed to process your request. ";

      if (result.retryCount > result.maxRetries) {
        errorMessage += `Maximum retry attempts (${result.maxRetries}) exceeded. `;
      }
      if (result.stepCount >= result.maxSteps) {
        errorMessage += `Maximum processing steps (${result.maxSteps}) exceeded. `;
      }

      errorMessage += `Error: ${result.lastError}`;

      return {
        success: false,
        data: null,
        message: errorMessage,
      };
    }

    // No output generated fallback
    logger.logError("Pipeline completed without output", {
      executionId,
      state: {
        promptType: result.projectCategory,
        stepCount: result.stepCount,
        hasResponse: !!result.finalPlan,
        hasPlan: !!result.finalPlan,
      },
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

    logger.logError("Pipeline execution exception", {
      executionId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      data: null,
      message: `Pipeline failed: ${errorMessage}. Please try again.`,
    };
  }
};

export const runPipelineStream = async function* (
  req: GeneratePlanRequest
): AsyncGenerator<Partial<PipelineState>, void, unknown> {
  const { prompt, history = [] } = req;
  const executionId = `stream_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  logger.logExecution("Stream execution started", { executionId });

  const validation = validatePipelineRequest(req);
  if (!validation.valid) {
    logger.logError("Stream validation failed", {
      executionId,
      error: validation.error,
    });
    yield {
      lastError: validation.error || "Invalid request",
    };
    return;
  }

  const modelManager = ModelManager.getInstance();
  await modelManager.initialize();

  const initialState = createInitialState(prompt, history);

  try {
    logger.logExecution("Starting stream", { executionId });

    const stream = await app.stream(initialState);

    for await (const chunk of stream) {
      const nodeKeys = Object.keys(chunk) as Array<keyof typeof chunk>;
      if (nodeKeys.length > 0) {
        const firstKey = nodeKeys[0];
        const nodeUpdate = chunk[firstKey];
        if (nodeUpdate) {
          logger.logExecution("Stream chunk", {
            executionId,
            node: firstKey,
            step: nodeUpdate.stepCount || 0,
          });
          yield nodeUpdate;
        }
      }
    }

    logger.logExecution("Stream completed", { executionId });
  } catch (error) {
    logger.logError("Stream execution error", {
      executionId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    yield {
      lastError: error instanceof Error ? error.message : "Stream failed",
    };
  }
};

export { workflow, app, createInitialState };
