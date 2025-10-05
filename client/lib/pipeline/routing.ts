// lib/pipeline/routing.ts
import { PipelineState } from "@/types/generatePlan";
import { END } from "@langchain/langgraph";

export const afterInitialAnalysis = (state: PipelineState): string => {
  if (state.needsClarification) return END;
  if (state.lastError) return "retryHandlerNode";
  return "classificationNode";
};

export const afterClassification = (state: PipelineState): string => {
  if (state.lastError) return "retryHandlerNode";
  return "sectionPlanningNode";
};

export const afterSectionPlanning = (state: PipelineState): string => {
  if (state.lastError) return "retryHandlerNode";
  return "sectionGeneratorNode";
};

export const afterSectionGenerator = (state: PipelineState): string => {
  if (state.lastError) return "retryHandlerNode";

  const allGenerated =
    state.generatedSections.size >= state.requiredSections.length;

  if (allGenerated) return "planAggregatorNode";
  return "sectionGeneratorNode";
};

export const afterRetry = (state: PipelineState): string => {
  if (state.retryCount > state.maxRetries) return "planAggregatorNode";

  const nodeMap: Record<string, string> = {
    initialAnalysis: "initialAnalysisNode",
    classification: "classificationNode",
    sectionPlanning: "sectionPlanningNode",
    sectionGenerator: "sectionGeneratorNode",
  };

  return nodeMap[state.failedNode || ""] || "classificationNode";
};
