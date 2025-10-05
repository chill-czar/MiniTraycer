// lib/pipeline/index.ts
import { StateGraph, END } from "@langchain/langgraph";
import {
  GeneratePlanRequest,
  GeneratePlanResponse,
  PlanData,
  PipelineState,
} from "@/types/generatePlan";
import { PipelineStateAnnotation } from "./state";
import {
  initialAnalysisNode,
  classificationNode,
  sectionPlanningNode,
  sectionGeneratorNode,
  planAggregatorNode,
  retryHandlerNode,
} from "./nodes";
import {
  afterInitialAnalysis,
  afterClassification,
  afterSectionPlanning,
  afterSectionGenerator,
  afterRetry,
} from "./routing";
import { ModelManager } from "../utils/modelManager";

const workflow = new StateGraph(PipelineStateAnnotation)
  .addNode("initialAnalysisNode", initialAnalysisNode)
  .addNode("classificationNode", classificationNode)
  .addNode("sectionPlanningNode", sectionPlanningNode)
  .addNode("sectionGeneratorNode", sectionGeneratorNode)
  .addNode("planAggregatorNode", planAggregatorNode)
  .addNode("retryHandlerNode", retryHandlerNode)
  .addEdge("__start__", "initialAnalysisNode")
  .addConditionalEdges("initialAnalysisNode", afterInitialAnalysis)
  .addConditionalEdges("classificationNode", afterClassification)
  .addConditionalEdges("sectionPlanningNode", afterSectionPlanning)
  .addConditionalEdges("sectionGeneratorNode", afterSectionGenerator)
  .addConditionalEdges("retryHandlerNode", afterRetry)
  .addEdge("planAggregatorNode", END);

const app = workflow.compile();

export const runPipeline = async (
  req: GeneratePlanRequest
): Promise<GeneratePlanResponse> => {
  const { prompt, history = [] } = req;

  const modelManager = ModelManager.getInstance();
  await modelManager.initialize();

  const initialState: PipelineState = {
    prompt,
    history,
    contextSummary: null,
    estimatedTokens: 0,
    needsClarification: false,
    clarificationQuestions: [],
    projectCategory: "unknown",
    detectedTechStack: [],
    suggestedTechStack: [],
    projectComplexity: "moderate",
    currentThinking: null,
    thinkingHistory: [],
    planSections: [],
    requiredSections: [],
    generatedSections: new Set<string>(),
    finalPlan: null,
    planSummary: null,
    modelUsed: "",
    totalTokensUsed: 0,
    retryCount: 0,
    maxRetries: 3,
    lastError: null,
    failedNode: null,
    stepCount: 0,
    maxSteps: 50,
  };

  try {
    const result = await app.invoke(initialState);

    if (result.needsClarification && result.clarificationQuestions.length > 0) {
      const questions = result.clarificationQuestions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n");

      return {
        success: false,
        data: null,
        message: `I need more information:\n\n${questions}\n\nPlease provide more details.`,
        needsClarification: true,
      };
    }

    if (!result.finalPlan || result.lastError) {
      let errorMessage = "Failed to generate plan. ";

      if (result.retryCount > result.maxRetries) {
        errorMessage += `Max retries exceeded. `;
      }
      if (result.stepCount >= result.maxSteps) {
        errorMessage += `Max steps exceeded. `;
      }
      if (result.lastError) {
        errorMessage += `Error: ${result.lastError}`;
      } else {
        errorMessage += "Please try again.";
      }

      return {
        success: false,
        data: null,
        message: errorMessage,
      };
    }

    const planData: PlanData = {
      markdown: result.finalPlan,
      summary: result.planSummary || "Summary not available",
      metadata: {
        generated_at: new Date().toISOString(),
        classification: result.projectCategory,
        model_used: result.modelUsed,
        total_tokens: result.totalTokensUsed,
        summary: result.planSummary || "",
      },
    };

    return {
      success: true,
      data: planData,
      message: "Plan generated successfully",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      data: null,
      message: `Pipeline failed: ${errorMessage}`,
    };
  }
};
