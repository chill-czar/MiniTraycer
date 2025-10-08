import { LLMInvoker } from "../utils/llmInvoker";
import { ContextManager } from "../utils/contextManager";
import { parseJSON } from "../utils/jsonParser";
import { PipelineState, Section } from "./state";
import { ThinkingResult, PlanSection } from "@/types/domain";
import { Logger } from "../utils/logger";
import { PROMPTS, injectVariables } from "../utils/prompts";

const llm = new LLMInvoker();
const contextMgr = ContextManager.getInstance();
const logger = Logger.getInstance();

const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

const isIntentClear = (
  confidence: number,
  hasDetails: boolean,
  missingInfo: string[],
  canProceedWithDefaults: boolean
): boolean => {
  if (confidence >= 0.7) {
    logger.logAnalysis("Intent is clear - high confidence", { confidence });
    return true;
  }

  if (confidence >= 0.5 && canProceedWithDefaults) {
    logger.logAnalysis("Intent is clear - can proceed with defaults", {
      confidence,
      canProceedWithDefaults,
    });
    return true;
  }

  if (hasDetails && missingInfo.length === 0) {
    logger.logAnalysis("Intent is clear - has sufficient details", {
      hasDetails,
      missingInfoCount: 0,
    });
    return true;
  }

  logger.logAnalysis("Intent is unclear - needs clarification", {
    confidence,
    hasDetails,
    missingInfoCount: missingInfo.length,
    canProceedWithDefaults,
  });
  return false;
};

const applyDefaults = (state: PipelineState): Partial<PipelineState> => {
  logger.logContext("Applying default values for missing information");

  const defaults: Partial<PipelineState> = {};

  if (!state.detectedTechStack || state.detectedTechStack.length === 0) {
    defaults.suggestedTechStack = [
      "Modern web technologies",
      "Cloud-native tools",
    ];
    logger.logContext("Applied default tech stack");
  }

  if (!state.projectComplexity) {
    defaults.projectComplexity = "moderate";
    logger.logContext("Applied default complexity: moderate");
  }

  return defaults;
};

const calculateAdaptiveMaxTokens = (
  sectionTitle: string,
  inputContext: string,
  complexity: string
): number => {
  const baseTokens = estimateTokens(inputContext);

  const complexityFactors = {
    simple: 1.5,
    moderate: 2.5,
    complex: 4.0,
  };

  const factor =
    complexityFactors[complexity as keyof typeof complexityFactors] || 2.5;

  let maxTokens = Math.floor(baseTokens * factor);
  maxTokens = Math.max(2000, maxTokens);
  maxTokens = Math.min(8000, maxTokens);

  logger.logTokenCalculation("Adaptive token calculation", {
    section: sectionTitle,
    inputTokens: baseTokens,
    complexity,
    factor,
    calculatedMaxTokens: maxTokens,
  });

  return maxTokens;
};

const isUserSkippingClarification = (prompt: string): boolean => {
  const skipPhrases = [
    "i don't know",
    "not sure",
    "skip",
    "just proceed",
    "use defaults",
    "whatever works",
    "you decide",
    "surprise me",
  ];

  const lowerPrompt = prompt.toLowerCase();
  return skipPhrases.some((phrase) => lowerPrompt.includes(phrase));
};

export const initialAnalysisNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  logger.logNodeStart("initialAnalysisNode", {
    prompt: state.userPrompt.slice(0, 100),
    historyLength: state.history.length,
    stepCount: state.stepCount,
  });

  if (state.stepCount >= state.maxSteps) {
    logger.logNodeError("initialAnalysisNode", "Max steps exceeded", {
      stepCount: state.stepCount,
      maxSteps: state.maxSteps,
    });
    return {
      lastError: "Max steps exceeded",
      failedNode: "initialAnalysis",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    if (isUserSkippingClarification(state.userPrompt)) {
      logger.logAnalysis(
        "User wants to skip clarification - proceeding with defaults",
        {
          prompt: state.userPrompt.slice(0, 100),
        }
      );

      const defaults = applyDefaults(state);

      return {
        needsClarification: false,
        clarificationQuestions: [],
        intentConfidence: 0.6,
        currentThinking: {
          reasoning: "User opted to skip clarification, using defaults",
          decisions: ["Proceed to section planning with default assumptions"],
          assumptions: ["Using reasonable default values"],
          nextAction: "sectionPlanning",
        },
        ...defaults,
        stepCount: state.stepCount + 1,
      };
    }

    const { context, estimatedTokens } = contextMgr.buildContext(
      state.userPrompt,
      state.history
    );

    logger.logContext("Initial analysis context built", {
      contextLength: context.length,
      estimatedTokens,
    });

    const historyContext =
      state.history.length > 0
        ? `\nConversation history:\n${context}`
        : "\nNo previous conversation.";

    const analysisPrompt = injectVariables(PROMPTS.INITIAL_ANALYSIS, {
      prompt: state.userPrompt,
      historyContext,
    });

    const inputTokens = estimateTokens(analysisPrompt);
    const maxTokens = Math.max(500, Math.floor(inputTokens * 0.6));

    logger.logLLMCall("Initial analysis LLM call", {
      inputTokens,
      maxTokens,
      temperature: 0.3,
    });

    const result = await llm.invoke({
      messages: [
        {
          role: "system",
          content: "You are an expert project requirements analyst.",
        },
        { role: "user", content: analysisPrompt },
      ],
      maxTokens,
      temperature: 0.3,
    });

    logger.logLLMResponse("Initial analysis response received", {
      responseLength: result.content.length,
      tokensUsed: result.tokensUsed,
      modelUsed: result.modelUsed,
    });

    const analysis = parseJSON<{
      isVague: boolean;
      hasSufficientDetail: boolean;
      detectedIntent: string;
      missingInfo: string[];
      confidence: number;
      reasoning: string;
      canProceedWithDefaults?: boolean;
    }>(result.content, {
      isVague: state.userPrompt.split(/\s+/).length < 10,
      hasSufficientDetail: state.userPrompt.split(/\s+/).length >= 15,
      detectedIntent: "unknown",
      missingInfo: [],
      confidence: 0.5,
      reasoning: "Default analysis",
      canProceedWithDefaults: false,
    });

    logger.logAnalysis("Analysis result", {
      isVague: analysis.isVague,
      hasSufficientDetail: analysis.hasSufficientDetail,
      confidence: analysis.confidence,
      detectedIntent: analysis.detectedIntent,
      missingInfoCount: analysis.missingInfo.length,
      canProceedWithDefaults: analysis.canProceedWithDefaults,
    });

    const shouldClarify = !isIntentClear(
      analysis.confidence,
      analysis.hasSufficientDetail,
      analysis.missingInfo,
      analysis.canProceedWithDefaults || false
    );

    const defaults = !shouldClarify ? applyDefaults(state) : {};

    const thinking: ThinkingResult = {
      reasoning: analysis.reasoning,
      decisions: shouldClarify
        ? ["Request clarification - insufficient detail"]
        : [
            "Proceed to section planning - sufficient detail or can use defaults",
          ],
      assumptions: analysis.canProceedWithDefaults
        ? ["Can proceed with reasonable defaults if needed"]
        : [],
      nextAction: shouldClarify ? "clarification" : "sectionPlanning",
    };

    logger.logNodeEnd("initialAnalysisNode", {
      needsClarification: shouldClarify,
      confidence: analysis.confidence,
      nextAction: thinking.nextAction,
    });

    return {
      needsClarification: shouldClarify,
      clarificationQuestions: shouldClarify ? analysis.missingInfo : [],
      intentConfidence: analysis.confidence,
      estimatedTokens,
      contextSummary:
        context.length > 1000 ? context.slice(0, 1000) + "..." : context,
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      ...defaults,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    logger.logNodeError(
      "initialAnalysisNode",
      error instanceof Error ? error.message : "Unknown error",
      { stack: error instanceof Error ? error.stack : undefined }
    );
    return {
      lastError: error instanceof Error ? error.message : "Analysis failed",
      failedNode: "initialAnalysis",
      stepCount: state.stepCount + 1,
    };
  }
};

export const clarificationNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  logger.logNodeStart("clarificationNode", {
    stepCount: state.stepCount,
    existingQuestions: state.clarificationQuestions.length,
  });

  if (state.stepCount >= state.maxSteps) {
    logger.logNodeError("clarificationNode", "Max steps exceeded", {
      stepCount: state.stepCount,
      maxSteps: state.maxSteps,
    });
    return {
      lastError: "Max steps exceeded",
      failedNode: "clarification",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    if (
      state.clarificationQuestions &&
      state.clarificationQuestions.length > 0
    ) {
      logger.logClarification("Using existing clarification questions", {
        questionCount: state.clarificationQuestions.length,
        questions: state.clarificationQuestions,
      });

      return {
        needsClarification: true,
        currentThinking: {
          reasoning: "Using clarification questions from initial analysis",
          decisions: ["Present questions to user"],
          assumptions: [],
          nextAction: "await_user_input",
        },
        stepCount: state.stepCount + 1,
      };
    }

    const historyContext = state.contextSummary || "No previous conversation.";
    const missingInfo =
      state.clarificationQuestions.length > 0
        ? state.clarificationQuestions.join(", ")
        : "Core project requirements and goals";

    const clarificationPrompt = injectVariables(PROMPTS.CLARIFICATION, {
      prompt: state.userPrompt,
      historyContext,
      missingInfo,
    });

    logger.logLLMCall("Clarification LLM call", {
      inputLength: clarificationPrompt.length,
    });

    const result = await llm.invoke({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at asking clarifying questions to understand project requirements.",
        },
        { role: "user", content: clarificationPrompt },
      ],
      maxTokens: 500,
      temperature: 0.7,
    });

    logger.logLLMResponse("Clarification response received", {
      tokensUsed: result.tokensUsed,
    });

    const clarification = parseJSON<{
      questions: string[];
      reasoning: string;
    }>(result.content, {
      questions: [
        "What is the main goal or purpose of your project?",
        "What key features or functionality do you need?",
        "Are there any specific technologies you want to use?",
      ],
      reasoning: "Default clarification",
    });

    logger.logClarification("Generated clarification questions", {
      questionCount: clarification.questions.length,
      questions: clarification.questions,
      reasoning: clarification.reasoning,
    });

    return {
      needsClarification: true,
      clarificationQuestions: clarification.questions,
      currentThinking: {
        reasoning: clarification.reasoning,
        decisions: ["Generated clarification questions"],
        assumptions: [],
        nextAction: "await_user_input",
      },
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    logger.logNodeError(
      "clarificationNode",
      error instanceof Error ? error.message : "Unknown error",
      { stack: error instanceof Error ? error.stack : undefined }
    );
    return {
      lastError:
        error instanceof Error ? error.message : "Clarification failed",
      failedNode: "clarification",
      stepCount: state.stepCount + 1,
    };
  }
};

export const sectionPlanningNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  logger.logNodeStart("sectionPlanningNode", {
    prompt: state.userPrompt.slice(0, 100),
    stepCount: state.stepCount,
  });

  if (state.stepCount >= state.maxSteps) {
    logger.logNodeError("sectionPlanningNode", "Max steps exceeded", {
      stepCount: state.stepCount,
      maxSteps: state.maxSteps,
    });
    return {
      lastError: "Max steps exceeded",
      failedNode: "sectionPlanning",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    let classificationTokens = 0;

    if (!state.projectCategory) {
      const classificationPrompt = injectVariables(
        PROMPTS.PROJECT_CLASSIFICATION,
        {
          prompt: state.userPrompt,
        }
      );

      logger.logLLMCall("Project classification", {
        inputLength: classificationPrompt.length,
      });

      const classResult = await llm.invoke({
        messages: [
          {
            role: "system",
            content:
              "You are an expert at analyzing and classifying software projects.",
          },
          { role: "user", content: classificationPrompt },
        ],
        maxTokens: 600,
        temperature: 0.3,
      });

      logger.logLLMResponse("Classification response received", {
        tokensUsed: classResult.tokensUsed,
      });

      const classification = parseJSON<{
        category: string;
        detectedStack: string[];
        suggestedStack: string[];
        complexity: "simple" | "moderate" | "complex";
        reasoning: string;
      }>(classResult.content, {
        category: "general_project",
        detectedStack: [],
        suggestedStack: [],
        complexity: "moderate",
        reasoning: "Default classification",
      });

      logger.logClassification("Project classified", {
        category: classification.category,
        detectedStack: classification.detectedStack,
        suggestedStack: classification.suggestedStack,
        complexity: classification.complexity,
      });

      classificationTokens = classResult.tokensUsed;

      state.projectCategory = classification.category;
      state.detectedTechStack = classification.detectedStack;
      state.suggestedTechStack = classification.suggestedStack;
      state.projectComplexity = classification.complexity;
    }

    const technologies = [
      ...state.detectedTechStack,
      ...state.suggestedTechStack,
    ].join(", ");

    const planningPrompt = injectVariables(PROMPTS.SECTION_PLANNING, {
      prompt: state.userPrompt,
      category: state.projectCategory || "general_project",
      technologies: technologies || "To be determined",
      complexity: state.projectComplexity || "moderate",
    });

    logger.logLLMCall("Section planning", {
      projectCategory: state.projectCategory,
      complexity: state.projectComplexity,
    });

    const result = await llm.invoke({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at structuring comprehensive technical project plans.",
        },
        { role: "user", content: planningPrompt },
      ],
      maxTokens: 1200,
      temperature: 0.5,
    });

    logger.logLLMResponse("Section planning response received", {
      tokensUsed: result.tokensUsed,
    });

    const plan = parseJSON<{
      sections: Section[];
      reasoning: string;
      estimatedComplexity: "simple" | "moderate" | "complex";
    }>(result.content, {
      sections: [
        {
          title: "Project Overview",
          description:
            "High-level description of the project, its goals, and expected outcomes",
          intent: "Establish project context",
          priority: 10,
        },
      ],
      reasoning: "Default plan",
      estimatedComplexity: "moderate",
    });

    const sortedSections = plan.sections.sort(
      (a, b) => b.priority - a.priority
    );

    logger.logPlanning("Section plan generated", {
      sectionCount: sortedSections.length,
      sections: sortedSections.map((s) => ({
        title: s.title,
        priority: s.priority,
      })),
      reasoning: plan.reasoning,
    });

    const thinking: ThinkingResult = {
      reasoning: plan.reasoning,
      decisions: [`Generated ${sortedSections.length} sections dynamically`],
      assumptions: [],
      nextAction: "generate_sections",
    };

    logger.logNodeEnd("sectionPlanningNode", {
      sectionCount: sortedSections.length,
      nextAction: "sectionGeneratorNode",
    });

    return {
      sections: sortedSections,
      projectCategory: state.projectCategory,
      detectedTechStack: state.detectedTechStack,
      suggestedTechStack: state.suggestedTechStack,
      projectComplexity: state.projectComplexity,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed + classificationTokens,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    logger.logNodeError(
      "sectionPlanningNode",
      error instanceof Error ? error.message : "Unknown error",
      { stack: error instanceof Error ? error.stack : undefined }
    );
    return {
      lastError:
        error instanceof Error ? error.message : "Section planning failed",
      failedNode: "sectionPlanning",
      stepCount: state.stepCount + 1,
    };
  }
};

export const sectionGeneratorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  logger.logNodeStart("sectionGeneratorNode", {
    stepCount: state.stepCount,
    totalSections: state.sections?.length || 0,
    generatedCount: state.generatedSections.size,
  });

  if (state.stepCount >= state.maxSteps) {
    logger.logNodeError("sectionGeneratorNode", "Max steps exceeded", {
      stepCount: state.stepCount,
      maxSteps: state.maxSteps,
    });
    return {
      lastError: "Max steps exceeded",
      failedNode: "sectionGenerator",
      stepCount: state.stepCount + 1,
    };
  }

  if (!state.sections || state.sections.length === 0) {
    logger.logNodeError("sectionGeneratorNode", "No sections to generate");
    return {
      lastError: "No sections to generate",
      failedNode: "sectionGenerator",
      stepCount: state.stepCount + 1,
    };
  }

  const remaining = state.sections.filter(
    (s) => !state.generatedSections.has(s.title)
  );

  if (remaining.length === 0) {
    logger.logNodeEnd("sectionGeneratorNode", {
      message: "All sections generated",
    });
    return { stepCount: state.stepCount + 1 };
  }

  const currentSection = remaining[0];
  const progress = `${state.generatedSections.size + 1}/${
    state.sections.length
  }`;

  logger.logSectionGeneration("Starting section generation", {
    section: currentSection.title,
    progress,
    priority: currentSection.priority,
    description: currentSection.description,
  });

  try {
    const previousSectionsContext =
      state.planSections.length > 0
        ? `**Previously Generated Sections** (for context and continuity):\n${state.planSections
            .map((s, idx) => {
              const contentPreview =
                idx >= state.planSections.length - 3
                  ? s.content.slice(0, 500)
                  : s.content.slice(0, 200);
              return `### ${s.title}\n${contentPreview}${
                s.content.length > contentPreview.length ? "..." : ""
              }`;
            })
            .join("\n\n")}`
        : "**Note**: This is the first section of the plan.";

    const technologies = [
      ...state.detectedTechStack,
      ...state.suggestedTechStack,
    ].join(", ");

    const generatorPrompt = injectVariables(PROMPTS.SECTION_GENERATION, {
      prompt: state.userPrompt,
      projectType: state.projectCategory || "general_project",
      technologies: technologies || "To be determined",
      complexity: state.projectComplexity || "moderate",
      sectionTitle: currentSection.title,
      sectionDescription: currentSection.description,
      sectionIntent: currentSection.intent,
      previousSectionsContext,
    });

    const fullContext = generatorPrompt + previousSectionsContext;
    const adaptiveMaxTokens = calculateAdaptiveMaxTokens(
      currentSection.title,
      fullContext,
      state.projectComplexity || "moderate"
    );

    logger.logLLMCall("Section content generation", {
      section: currentSection.title,
      contextLength: fullContext.length,
      previousSections: state.planSections.length,
      maxTokens: adaptiveMaxTokens,
    });

    const result = await llm.invoke({
      messages: [
        {
          role: "system",
          content:
            "You are an expert technical writer creating comprehensive, implementation-ready project documentation. Your writing is detailed, specific, and actionable.",
        },
        { role: "user", content: generatorPrompt },
      ],
      maxTokens: adaptiveMaxTokens,
      temperature: 0.7,
    });

    logger.logLLMResponse("Section content generated", {
      section: currentSection.title,
      contentLength: result.content.length,
      tokensUsed: result.tokensUsed,
      wordCount: Math.floor(result.content.split(/\s+/).length),
    });

    const newSection: PlanSection = {
      title: currentSection.title,
      content: result.content.trim(),
      order: state.planSections.length + 1,
    };

    const updatedGenerated = new Set(state.generatedSections);
    updatedGenerated.add(currentSection.title);

    const thinking: ThinkingResult = {
      reasoning: `Generated "${currentSection.title}" with ${result.content.length} characters`,
      decisions: [
        `Section ${updatedGenerated.size}/${state.sections.length} complete`,
      ],
      assumptions: [],
      nextAction:
        updatedGenerated.size < state.sections.length
          ? "generate_next_section"
          : "aggregate_plan",
    };

    logger.logSectionGeneration("Section generation complete", {
      section: currentSection.title,
      contentLength: result.content.length,
      progress: `${updatedGenerated.size}/${state.sections.length}`,
      nextAction: thinking.nextAction,
    });

    return {
      planSections: [newSection],
      generatedSections: updatedGenerated,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    logger.logNodeError(
      "sectionGeneratorNode",
      error instanceof Error ? error.message : "Unknown error",
      {
        section: currentSection.title,
        progress,
        stack: error instanceof Error ? error.stack : undefined,
      }
    );
    return {
      lastError:
        error instanceof Error ? error.message : "Section generation failed",
      failedNode: "sectionGenerator",
      stepCount: state.stepCount + 1,
    };
  }
};

export const planAggregatorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  logger.logNodeStart("planAggregatorNode", {
    sectionCount: state.planSections.length,
    stepCount: state.stepCount,
  });

  if (state.stepCount >= state.maxSteps) {
    logger.logNodeError("planAggregatorNode", "Max steps exceeded", {
      stepCount: state.stepCount,
      maxSteps: state.maxSteps,
    });
    return {
      lastError: "Max steps exceeded",
      failedNode: "planAggregator",
      stepCount: state.stepCount + 1,
    };
  }

  if (state.planSections.length === 0) {
    logger.logNodeError("planAggregatorNode", "No sections to aggregate");
    return {
      lastError: "No sections generated",
      failedNode: "planAggregator",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    const sorted = [...state.planSections].sort((a, b) => a.order - b.order);

    logger.logAggregation("Aggregating sections", {
      totalSections: sorted.length,
      totalContentLength: sorted.reduce((sum, s) => sum + s.content.length, 0),
    });

    const sectionContent = sorted
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join("\n\n---\n\n");

    const technologies = [
      ...state.detectedTechStack,
      ...state.suggestedTechStack,
    ].join(", ");

    const aggregatorPrompt = injectVariables(PROMPTS.PLAN_AGGREGATION, {
      category: state.projectCategory || "general_project",
      technologies: technologies || "To be determined",
      complexity: state.projectComplexity || "moderate",
      sectionCount: sorted.length.toString(),
      sections: sectionContent,
      date: new Date().toISOString().split("T")[0],
    });

    logger.logLLMCall("Plan aggregation and finalization", {
      sectionCount: sorted.length,
      totalContentLength: sectionContent.length,
    });

    const result = await llm.invoke({
      messages: [
        {
          role: "system",
          content:
            "You are a technical documentation expert who creates polished, professional project plans from individual sections.",
        },
        { role: "user", content: aggregatorPrompt },
      ],
      maxTokens: 3000,
      temperature: 0.5,
    });

    logger.logLLMResponse("Plan aggregation complete", {
      finalLength: result.content.length,
      tokensUsed: result.tokensUsed,
    });

    let summary: string;
    try {
      logger.logContext("Generating plan summary");
      summary = await contextMgr.generateSummary(result.content);
      logger.logContext("Summary generated", { length: summary.length });
    } catch (error) {
      console.log(error)
      logger.logContext("Summary generation failed, using fallback");
      summary = `Comprehensive ${
        state.projectCategory || "project"
      } plan with ${sorted.length} sections covering ${technologies}`;
    }

    const thinking: ThinkingResult = {
      reasoning: "Plan aggregated and finalized successfully",
      decisions: [`Combined ${sorted.length} sections into polished plan`],
      assumptions: [],
      nextAction: "complete",
    };

    logger.logNodeEnd("planAggregatorNode", {
      success: true,
      finalPlanLength: result.content.length,
      summaryLength: summary.length,
    });

    return {
      finalPlan: result.content.trim(),
      planSummary: summary,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    logger.logNodeError(
      "planAggregatorNode",
      error instanceof Error ? error.message : "Unknown error",
      { stack: error instanceof Error ? error.stack : undefined }
    );

    const sorted = [...state.planSections].sort((a, b) => a.order - b.order);
    const technologies = [
      ...state.detectedTechStack,
      ...state.suggestedTechStack,
    ].join(", ");

    const plan = [
      `# 🚀 Development Plan`,
      ``,
      `**Type:** ${state.projectCategory || "Unknown"}`,
      `**Stack:** ${technologies}`,
      `**Complexity:** ${state.projectComplexity}`,
      ``,
      `---`,
      ``,
      ...sorted.flatMap((s) => [``, s.content, ``, `---`, ``]),
    ].join("\n");

    logger.logAggregation("Using fallback aggregation", {
      planLength: plan.length,
    });

    return {
      finalPlan: plan,
      planSummary: `${state.projectCategory} with ${sorted.length} sections`,
      lastError: error instanceof Error ? error.message : "Aggregation warning",
      stepCount: state.stepCount + 1,
    };
  }
};

export const retryHandlerNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const newRetryCount = state.retryCount + 1;

  logger.logNodeStart("retryHandlerNode", {
    retryCount: newRetryCount,
    maxRetries: state.maxRetries,
    failedNode: state.failedNode,
    error: state.lastError,
  });

  if (newRetryCount > state.maxRetries) {
    logger.logNodeError("retryHandlerNode", "Max retries exceeded", {
      retryCount: newRetryCount,
      maxRetries: state.maxRetries,
    });
    return {
      retryCount: newRetryCount,
      lastError: `Max retries (${state.maxRetries}) exceeded. Last error: ${state.lastError}`,
      stepCount: state.stepCount + 1,
    };
  }

  const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);

  logger.logRetry("Applying exponential backoff", {
    retryCount: newRetryCount,
    delayMs: delay,
    failedNode: state.failedNode,
  });

  await new Promise((resolve) => setTimeout(resolve, delay));

  const thinking: ThinkingResult = {
    reasoning: `Retry attempt ${newRetryCount}/${state.maxRetries} after ${delay}ms delay`,
    decisions: ["Retrying failed node"],
    assumptions: ["Error may be transient"],
    nextAction: `retry_${state.failedNode}`,
  };

  logger.logNodeEnd("retryHandlerNode", {
    retryCount: newRetryCount,
    nextAction: thinking.nextAction,
  });

  return {
    retryCount: newRetryCount,
    lastError: null,
    currentThinking: thinking,
    thinkingHistory: [thinking],
    stepCount: state.stepCount + 1,
  };
};
