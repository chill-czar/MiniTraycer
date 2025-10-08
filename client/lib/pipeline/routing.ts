import { PipelineState } from "./state";
import { END } from "@langchain/langgraph";
import { Logger } from "../utils/logger";

const logger = Logger.getInstance();

export const afterInitialAnalysis = (state: PipelineState): string => {
  if (state.lastError) {
    logger.logExecution("Routing: initialAnalysis → retry", {
      error: state.lastError,
      step: state.stepCount,
    });
    return "retryHandlerNode";
  }

  if (state.needsClarification && state.clarificationQuestions.length > 0) {
    logger.logExecution("Routing: initialAnalysis → clarification", {
      questionCount: state.clarificationQuestions.length,
      questions: state.clarificationQuestions,
      step: state.stepCount,
    });
    return "clarificationNode";
  }

  logger.logExecution("Routing: initialAnalysis → sectionPlanning", {
    confidence: state.intentConfidence,
    step: state.stepCount,
  });
  return "sectionPlanningNode";
};

export const afterClarification = (state: PipelineState): string => {
  logger.logExecution("Routing: clarification → END (awaiting user input)", {
    step: state.stepCount,
  });
  return END;
};

export const afterSectionPlanning = (state: PipelineState): string => {
  if (state.lastError) {
    logger.logExecution("Routing: sectionPlanning → retry", {
      error: state.lastError,
      step: state.stepCount,
    });
    return "retryHandlerNode";
  }

  if (!state.sections || state.sections.length === 0) {
    logger.logExecution("Routing: sectionPlanning → retry (no sections)", {
      step: state.stepCount,
    });
    return "retryHandlerNode";
  }

  logger.logExecution("Routing: sectionPlanning → sectionGenerator", {
    sectionCount: state.sections.length,
    sections: state.sections.map((s) => s.title),
    step: state.stepCount,
  });
  return "sectionGeneratorNode";
};

export const afterSectionGenerator = (state: PipelineState): string => {
  if (state.lastError) {
    const isRecoverable =
      state.lastError.includes("timeout") ||
      state.lastError.includes("rate limit") ||
      state.lastError.includes("network");

    if (isRecoverable && state.retryCount < state.maxRetries) {
      logger.logExecution("Routing: sectionGenerator → retry (recoverable)", {
        error: state.lastError,
        retryCount: state.retryCount,
        step: state.stepCount,
      });
      return "retryHandlerNode";
    }

    if (state.planSections.length > 0) {
      logger.logExecution("Routing: sectionGenerator → aggregator (salvage)", {
        partialSections: state.planSections.length,
        error: state.lastError,
        step: state.stepCount,
      });
      return "planAggregatorNode";
    }

    logger.logExecution("Routing: sectionGenerator → retry (unrecoverable)", {
      error: state.lastError,
      step: state.stepCount,
    });
    return "retryHandlerNode";
  }

  const totalSections = state.sections?.length || 0;
  const generatedCount = state.generatedSections.size;

  if (generatedCount >= totalSections && totalSections > 0) {
    logger.logExecution("Routing: sectionGenerator → aggregator (complete)", {
      totalSections,
      generatedCount,
      step: state.stepCount,
    });
    return "planAggregatorNode";
  }

  const remaining =
    state.sections?.filter((s) => !state.generatedSections.has(s.title)) || [];

  logger.logExecution("Routing: sectionGenerator → sectionGenerator (loop)", {
    progress: `${generatedCount}/${totalSections}`,
    remaining: remaining.map((s) => s.title),
    step: state.stepCount,
  });
  return "sectionGeneratorNode";
};

export const afterPlanAggregator = (state: PipelineState): string => {
  logger.logExecution("Routing: planAggregator → END (complete)", {
    planLength: state.finalPlan?.length || 0,
    step: state.stepCount,
  });
  return END;
};

export const afterRetry = (state: PipelineState): string => {
  if (state.retryCount > state.maxRetries) {
    logger.logExecution("Routing: retry → salvage/END", {
      retryCount: state.retryCount,
      maxRetries: state.maxRetries,
      step: state.stepCount,
    });

    if (state.planSections.length > 0) {
      logger.logExecution("Routing: retry → aggregator (salvage)", {
        partialSections: state.planSections.length,
        step: state.stepCount,
      });
      return "planAggregatorNode";
    }

    logger.logExecution("Routing: retry → END (max retries)", {
      step: state.stepCount,
    });
    return END;
  }

  const nodeMap: Record<string, string> = {
    initialAnalysis: "initialAnalysisNode",
    clarification: "clarificationNode",
    sectionPlanning: "sectionPlanningNode",
    sectionGenerator: "sectionGeneratorNode",
    planAggregator: "planAggregatorNode",
  };

  const targetNode = nodeMap[state.failedNode || ""] || "sectionPlanningNode";

  logger.logExecution(`Routing: retry → ${targetNode}`, {
    attempt: state.retryCount,
    maxRetries: state.maxRetries,
    failedNode: state.failedNode,
    step: state.stepCount,
  });

  return targetNode;
};

export const isTerminalState = (state: PipelineState): boolean => {
  return !!(
    state.finalPlan ||
    state.needsClarification ||
    (state.lastError && state.retryCount > state.maxRetries) ||
    state.stepCount >= state.maxSteps
  );
};

export const analyzeError = (
  error: string
): {
  isRecoverable: boolean;
  suggestedAction: "retry" | "skip" | "fail";
  reason: string;
} => {
  const lowerError = error.toLowerCase();

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

  if (lowerError.includes("json") || lowerError.includes("parse")) {
    return {
      isRecoverable: true,
      suggestedAction: "retry",
      reason: "JSON parsing error",
    };
  }

  if (
    lowerError.includes("auth") ||
    lowerError.includes("401") ||
    lowerError.includes("403")
  ) {
    return {
      isRecoverable: false,
      suggestedAction: "fail",
      reason: "Authentication error",
    };
  }

  if (
    lowerError.includes("max") ||
    lowerError.includes("exceeded") ||
    lowerError.includes("invalid")
  ) {
    return {
      isRecoverable: false,
      suggestedAction: "skip",
      reason: "Validation error",
    };
  }

  return {
    isRecoverable: true,
    suggestedAction: "retry",
    reason: "Unknown error - attempting recovery",
  };
};
