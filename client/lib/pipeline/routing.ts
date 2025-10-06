// lib/pipeline/routing.ts - FULLY OPTIMIZED
import { PipelineState } from "./state";
import { END } from "@langchain/langgraph";

/**
 * After Initial Analysis - OPTIMIZED
 */
export const afterInitialAnalysis = (state: PipelineState): string => {
  if (state.lastError) {
    console.log(
      `[Routing] initialAnalysis → retry (error: ${state.lastError})`
    );
    return "retryHandlerNode";
  }

  if (state.needsClarification && state.clarificationQuestions.length > 0) {
    console.log(`[Routing] initialAnalysis → END (needs clarification)`);
    return END;
  }

  console.log(`[Routing] initialAnalysis → classification`);
  return "classificationNode";
};

/**
 * After Classification - OPTIMIZED with smart routing
 */
export const afterClassification = (state: PipelineState): string => {
  if (state.lastError) {
    console.log(`[Routing] classification → retry (error: ${state.lastError})`);
    return "retryHandlerNode";
  }

  // Data-driven routing based on classification result
  const route = (() => {
    switch (state.promptType) {
      case "general":
        return "generalResponseNode";
      case "chatbot":
        return "chatbotResponseNode";
      case "builder":
        return "sectionPlanningNode";
      case "unclear":
        return "clarificationNode";
      default:
        // Fallback based on confidence and history
        if (state.intentConfidence && state.intentConfidence < 0.5) {
          return "clarificationNode";
        }
        return state.history.length > 0
          ? "chatbotResponseNode"
          : "generalResponseNode";
    }
  })();

  console.log(
    `[Routing] classification → ${route} (type: ${state.promptType}, confidence: ${state.intentConfidence})`
  );
  return route;
};

/**
 * After Clarification
 */
export const afterClarification = (state: PipelineState): string => {
  console.log(`[Routing] clarification → END (awaiting user input)`);
  return END;
};

/**
 * After General Response
 */
export const afterGeneralResponse = (state: PipelineState): string => {
  if (state.lastError) {
    console.log(
      `[Routing] generalResponse → retry (error: ${state.lastError})`
    );
    return "retryHandlerNode";
  }

  console.log(`[Routing] generalResponse → END (complete)`);
  return END;
};

/**
 * After Chatbot Response
 */
export const afterChatbotResponse = (state: PipelineState): string => {
  if (state.lastError) {
    console.log(
      `[Routing] chatbotResponse → retry (error: ${state.lastError})`
    );
    return "retryHandlerNode";
  }

  console.log(`[Routing] chatbotResponse → END (complete)`);
  return END;
};

/**
 * After Section Planning - OPTIMIZED with validation
 */
export const afterSectionPlanning = (state: PipelineState): string => {
  if (state.lastError) {
    console.log(
      `[Routing] sectionPlanning → retry (error: ${state.lastError})`
    );
    return "retryHandlerNode";
  }

  // Validate sections were planned
  if (!state.sections || state.sections.length === 0) {
    console.log(`[Routing] sectionPlanning → retry (no sections planned)`);
    return "retryHandlerNode";
  }

  console.log(
    `[Routing] sectionPlanning → sectionGenerator (${state.sections.length} sections to generate)`
  );
  return "sectionGeneratorNode";
};

/**
 * After Section Generator - OPTIMIZED looping logic
 */
export const afterSectionGenerator = (state: PipelineState): string => {
  if (state.lastError) {
    // Check if error is recoverable
    const isRecoverable =
      state.lastError.includes("timeout") ||
      state.lastError.includes("rate limit") ||
      state.lastError.includes("network");

    if (isRecoverable && state.retryCount < state.maxRetries) {
      console.log(
        `[Routing] sectionGenerator → retry (recoverable error: ${state.lastError})`
      );
      return "retryHandlerNode";
    }

    // If not recoverable and we have some sections, try to aggregate what we have
    if (state.planSections.length > 0) {
      console.log(
        `[Routing] sectionGenerator → aggregator (partial plan, ${state.planSections.length} sections)`
      );
      return "planAggregatorNode";
    }

    console.log(`[Routing] sectionGenerator → retry (unrecoverable error)`);
    return "retryHandlerNode";
  }

  const totalSections = state.sections?.length || 0;
  const generatedCount = state.generatedSections.size;

  // All sections complete
  if (generatedCount >= totalSections && totalSections > 0) {
    console.log(
      `[Routing] sectionGenerator → aggregator (${generatedCount}/${totalSections} sections complete)`
    );
    return "planAggregatorNode";
  }

  // More sections to generate
  console.log(
    `[Routing] sectionGenerator → sectionGenerator (${generatedCount}/${totalSections} sections done, looping)`
  );
  return "sectionGeneratorNode";
};

/**
 * After Plan Aggregator
 */
export const afterPlanAggregator = (state: PipelineState): string => {
  console.log(`[Routing] planAggregator → END (plan complete)`);
  return END;
};

/**
 * After Retry Handler - OPTIMIZED with contextual routing
 */
export const afterRetry = (state: PipelineState): string => {
  // Max retries exceeded - try to salvage what we have
  if (state.retryCount > state.maxRetries) {
    console.log(
      `[Routing] retry → salvage mode (max retries exceeded: ${state.retryCount}/${state.maxRetries})`
    );

    // If we have partial plan sections, aggregate them
    if (state.planSections.length > 0) {
      console.log(
        `[Routing] retry → aggregator (salvaging ${state.planSections.length} sections)`
      );
      return "planAggregatorNode";
    }

    // If we have a partial response, end here
    if (state.finalResponse) {
      console.log(`[Routing] retry → END (has partial response)`);
      return END;
    }

    // Otherwise give up
    console.log(`[Routing] retry → END (giving up, no salvageable output)`);
    return END;
  }

  // Map failed nodes to retry targets
  const nodeMap: Record<string, string> = {
    initialAnalysis: "initialAnalysisNode",
    classification: "classificationNode",
    clarification: "clarificationNode",
    generalResponse: "generalResponseNode",
    chatbotResponse: "chatbotResponseNode",
    sectionPlanning: "sectionPlanningNode",
    sectionGenerator: "sectionGeneratorNode",
    planAggregator: "planAggregatorNode",
  };

  const targetNode = nodeMap[state.failedNode || ""] || "classificationNode";
  console.log(
    `[Routing] retry → ${targetNode} (attempt ${state.retryCount}/${state.maxRetries})`
  );

  return targetNode;
};

/**
 * Helper: Check if tools should be enabled for a node
 */
export const shouldEnableTools = (nodeName: string): boolean => {
  const toolEnabledNodes = ["generalResponseNode", "sectionGeneratorNode"];

  return toolEnabledNodes.includes(nodeName);
};

/**
 * Helper: Check if state is terminal
 */
export const isTerminalState = (state: PipelineState): boolean => {
  return !!(
    state.finalResponse ||
    state.finalPlan ||
    state.needsClarification ||
    (state.lastError && state.retryCount > state.maxRetries) ||
    state.stepCount >= state.maxSteps
  );
};

/**
 * Helper: Determine optimal next node dynamically
 * Used for recovery and optimization
 */
export const determineOptimalNext = (state: PipelineState): string => {
  // Priority 1: Clarification needed
  if (state.needsClarification) {
    return "clarificationNode";
  }

  // Priority 2: If no prompt type, classify
  if (!state.promptType) {
    return "classificationNode";
  }

  // Priority 3: Route based on type and completion
  switch (state.promptType) {
    case "general":
      return state.finalResponse ? END : "generalResponseNode";

    case "chatbot":
      return state.finalResponse ? END : "chatbotResponseNode";

    case "builder":
      if (state.finalPlan) return END;
      if (
        state.planSections.length > 0 &&
        state.generatedSections.size >= (state.sections?.length || 0)
      ) {
        return "planAggregatorNode";
      }
      if (state.sections && state.sections.length > 0) {
        return "sectionGeneratorNode";
      }
      return "sectionPlanningNode";

    default:
      return "classificationNode";
  }
};

/**
 * Helper: Analyze error type for smart retry decisions
 */
export const analyzeError = (
  error: string
): {
  isRecoverable: boolean;
  suggestedAction: "retry" | "skip" | "fail";
  reason: string;
} => {
  const lowerError = error.toLowerCase();

  // Transient errors - retry
  if (
    lowerError.includes("timeout") ||
    lowerError.includes("network") ||
    lowerError.includes("rate limit") ||
    lowerError.includes("503") ||
    lowerError.includes("502")
  ) {
    return {
      isRecoverable: true,
      suggestedAction: "retry",
      reason: "Transient network/API error",
    };
  }

  // Parsing errors - might be recoverable
  if (lowerError.includes("json") || lowerError.includes("parse")) {
    return {
      isRecoverable: true,
      suggestedAction: "retry",
      reason: "JSON parsing error - response format issue",
    };
  }

  // Authentication/permission errors - not recoverable
  if (
    lowerError.includes("auth") ||
    lowerError.includes("401") ||
    lowerError.includes("403") ||
    lowerError.includes("forbidden")
  ) {
    return {
      isRecoverable: false,
      suggestedAction: "fail",
      reason: "Authentication/authorization error",
    };
  }

  // Content/validation errors - skip node
  if (
    lowerError.includes("max") ||
    lowerError.includes("exceeded") ||
    lowerError.includes("invalid")
  ) {
    return {
      isRecoverable: false,
      suggestedAction: "skip",
      reason: "Validation or limit error",
    };
  }

  // Default: assume transient, retry once
  return {
    isRecoverable: true,
    suggestedAction: "retry",
    reason: "Unknown error - attempting recovery",
  };
};
