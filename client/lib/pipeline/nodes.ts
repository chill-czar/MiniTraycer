// lib/pipeline/nodes.ts

import { LLMInvoker } from "../utils/llmInvoker";
import { ContextManager } from "../utils/contextManager";
import { parseJSON } from "../utils/jsonParser";
import { PROMPTS, injectVariables, buildHistoryContext } from "../utils/prompts";
import { PipelineState, Section, ResponseMetadata, ToolResult } from "./state";
import { ThinkingResult, PlanSection } from "@/types/domain";

const llm = new LLMInvoker();
const contextMgr = ContextManager.getInstance();

/**
 * Estimate token count for dynamic budget allocation
 */
const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Helper to build messages array with optimized context
 */
const buildMessages = (
  systemPrompt: string,
  state: PipelineState,
  userContent: string,
  includeHistory: boolean = true
) => {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Use context summary if available (saves tokens)
  if (includeHistory && state.conversationContext) {
    messages.push({
      role: "system",
      content: `Previous conversation context: ${state.conversationContext}`,
    });
  } else if (includeHistory && state.history.length > 0) {
    // Only include last 3 messages for efficiency
    const historyToInclude = state.history.slice(-3);
    historyToInclude.forEach((msg) => {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.summary || msg.content,
      });
    });
  }

  messages.push({ role: "user", content: userContent });
  return messages;
};

/**
 * Initial Analysis Node - OPTIMIZED
 * Preprocesses input, evaluates clarity, uses cheap model
 */
export const initialAnalysisNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "initialAnalysis",
      stepCount: state.stepCount + 1,
    };
  }

  const { estimatedTokens } = contextMgr.buildContext(
    state.userPrompt,
    state.history
  );

  try {
    // Dynamic token allocation
    const inputTokens = estimateTokens(state.userPrompt);
    const maxTokens = Math.min(
      500,
      Math.max(300, Math.floor(inputTokens * 0.5))
    );

    const result = await llm.invoke({
      messages: buildMessages(
        PROMPTS.INITIAL_ANALYSIS,
        state,
        state.userPrompt
      ),
      maxTokens,
      temperature: 0.3, // Lower for classification tasks
    });

    const analysis = parseJSON<{
      isVague: boolean;
      hasSufficientDetail: boolean;
      detectedIntent: string;
      missingInfo: string[];
      confidence: number;
    }>(result.content, {
      isVague:
        state.history.length === 0 && state.userPrompt.split(/\s+/).length < 10,
      hasSufficientDetail:
        state.history.length > 0 || state.userPrompt.split(/\s+/).length >= 15,
      detectedIntent: "unknown",
      missingInfo: [],
      confidence: 0.5,
    });

    const shouldClarify =
      analysis.isVague &&
      !analysis.hasSufficientDetail &&
      analysis.confidence < 0.4 &&
      analysis.missingInfo.length > 0;

    const thinking: ThinkingResult = {
      reasoning: `Confidence: ${analysis.confidence}, Intent: ${analysis.detectedIntent}`,
      decisions: shouldClarify
        ? ["Request clarification"]
        : ["Proceed to classification"],
      assumptions: analysis.confidence < 0.6 ? ["Low confidence"] : [],
      nextAction: shouldClarify ? "clarification" : "classification",
    };

    return {
      needsClarification: shouldClarify,
      clarificationQuestions: shouldClarify ? analysis.missingInfo : [],
      detectedIntent: analysis.detectedIntent,
      intentConfidence: analysis.confidence,
      estimatedTokens,
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      stepCount: state.stepCount + 1, // FIX: Increment step count
    };
  } catch (error) {
    return {
      lastError: error instanceof Error ? error.message : "Analysis failed",
      failedNode: "initialAnalysis",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * Classification Node - OPTIMIZED
 * Uses cheap model and caches result
 */
export const classificationNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "classification",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    // Use cached context or build new one
    const effectiveContext =
      state.conversationContext || buildHistoryContext(state.history);
    const promptWithContext = `${state.userPrompt}\n\nContext: ${effectiveContext}`;

    // Dynamic token allocation
    const inputTokens = estimateTokens(promptWithContext);
    const maxTokens = Math.min(
      600,
      Math.max(400, Math.floor(inputTokens * 0.6))
    );

    const result = await llm.invoke({
      messages: buildMessages(
        PROMPTS.CLASSIFICATION,
        state,
        promptWithContext,
        false
      ),
      maxTokens,
      temperature: 0.2, // Very low for consistent classification
    });

    const classification = parseJSON<{
      type: "general" | "chatbot" | "builder" | "unclear";
      confidence: number;
      reasoning: string;
      detectedIntent: string;
    }>(result.content, {
      type: "general",
      confidence: 0.5,
      reasoning: "Default classification",
      detectedIntent: "unknown",
    });

    const thinking: ThinkingResult = {
      reasoning: classification.reasoning,
      decisions: [
        `Type: ${classification.type}`,
        `Confidence: ${classification.confidence}`,
      ],
      assumptions:
        classification.confidence < 0.7 ? ["May need refinement"] : [],
      nextAction: classification.type,
    };

    return {
      promptType: classification.type,
      intentConfidence: classification.confidence,
      detectedIntent: classification.detectedIntent,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "Classification failed",
      failedNode: "classification",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * Clarification Node - OPTIMIZED
 */
export const clarificationNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "clarification",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    const historyContext = buildHistoryContext(state.history);
    const clarificationPrompt = injectVariables(PROMPTS.CLARIFICATION, {
      prompt: state.userPrompt,
      history: historyContext,
    });

    const result = await llm.invoke({
      messages: [
        { role: "system", content: clarificationPrompt },
        { role: "user", content: "Generate clarification questions." },
      ],
      maxTokens: 400,
      temperature: 0.7,
    });

    const clarification = parseJSON<{
      questions: string[];
      reasoning: string;
    }>(result.content, {
      questions: ["Could you provide more details?", "What is your main goal?"],
      reasoning: "Default clarification",
    });

    return {
      needsClarification: true,
      clarificationQuestions: clarification.questions,
      currentThinking: {
        reasoning: clarification.reasoning,
        decisions: ["Ask for clarification"],
        assumptions: [],
        nextAction: "await_user_input",
      },
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "Clarification failed",
      failedNode: "clarification",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * General Response Node - OPTIMIZED
 * Token-efficient with dynamic budgeting
 */
export const generalResponseNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "generalResponse",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    const responsePrompt = injectVariables(PROMPTS.GENERAL_RESPONSE, {
      prompt: state.userPrompt,
    });

    // Dynamic token allocation based on input
    const inputTokens = estimateTokens(state.userPrompt);
    const maxTokens = Math.min(
      1000,
      Math.max(400, Math.floor(inputTokens * 1.5))
    );

    const result = await llm.invoke({
      messages: buildMessages(responsePrompt, state, state.userPrompt, false),
      maxTokens,
      temperature: 0.7,
    });

    const metadata: ResponseMetadata = {
      responseType: "factual",
      sourcesUsed: [],
      confidence: 0.9,
    };

    const thinking: ThinkingResult = {
      reasoning: "Generated factual response",
      decisions: ["Direct answer provided"],
      assumptions: [],
      nextAction: "complete",
    };

    return {
      finalResponse: result.content.trim(),
      responseMetadata: metadata,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "General response failed",
      failedNode: "generalResponse",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * Chatbot Response Node - OPTIMIZED
 * Uses context summary for efficiency
 */
export const chatbotResponseNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "chatbotResponse",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    // Use existing context summary or build new one
    let contextToUse = state.conversationContext;

    // Generate summary if history is long and no summary exists
    if (!contextToUse && state.history.length > 5) {
      const historyText = buildHistoryContext(state.history);
      contextToUse = await contextMgr.generateSummary(historyText);
    } else if (!contextToUse) {
      contextToUse = buildHistoryContext(state.history);
    }

    const chatbotPrompt = injectVariables(PROMPTS.CHATBOT_RESPONSE, {
      history: contextToUse,
      prompt: state.userPrompt,
    });

    const inputTokens = estimateTokens(state.userPrompt + contextToUse);
    const maxTokens = Math.min(
      800,
      Math.max(400, Math.floor(inputTokens * 1.2))
    );

    const result = await llm.invoke({
      messages: buildMessages(chatbotPrompt, state, state.userPrompt, false),
      maxTokens,
      temperature: 0.8,
    });

    const metadata: ResponseMetadata = {
      responseType: "conversational",
      sourcesUsed: [],
      confidence: 0.85,
    };

    const thinking: ThinkingResult = {
      reasoning: "Generated conversational response",
      decisions: ["Used conversation context"],
      assumptions: [],
      nextAction: "complete",
    };

    // Update context summary every 3 turns
    const shouldUpdateSummary =
      state.history.length % 3 === 0 && state.history.length > 5;
    let newContextSummary = state.conversationContext;

    if (shouldUpdateSummary) {
      try {
        const fullContext = `${contextToUse}\nUser: ${state.userPrompt}\nAssistant: ${result.content}`;
        newContextSummary = await contextMgr.generateSummary(fullContext);
      } catch {
        // Keep existing summary if generation fails
      }
    }

    return {
      finalResponse: result.content.trim(),
      responseMetadata: metadata,
      conversationContext: newContextSummary,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "Chatbot response failed",
      failedNode: "chatbotResponse",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * Section Planning Node - OPTIMIZED
 * Caches project classification to avoid redundant calls
 */
export const sectionPlanningNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "sectionPlanning",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    let projectContext = "";
    let classificationTokens = 0;

    // FIX: Only classify if not already done
    if (!state.projectCategory) {
      const classificationPrompt = injectVariables(
        PROMPTS.PROJECT_CLASSIFICATION,
        {
          prompt: state.userPrompt,
        }
      );

      const classResult = await llm.invoke({
        messages: [
          { role: "system", content: classificationPrompt },
          { role: "user", content: "Classify this project." },
        ],
        maxTokens: 500,
        temperature: 0.3,
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

      projectContext = `Category: ${classification.category}\nStack: ${[
        ...classification.detectedStack,
        ...classification.suggestedStack,
      ].join(", ")}\nComplexity: ${classification.complexity}`;
      classificationTokens = classResult.tokensUsed;

      // Cache classification in state
      Object.assign(state, {
        projectCategory: classification.category,
        detectedTechStack: classification.detectedStack,
        suggestedTechStack: classification.suggestedStack,
        projectComplexity: classification.complexity,
      });
    } else {
      projectContext = `Category: ${state.projectCategory}\nStack: ${[
        ...state.detectedTechStack,
        ...state.suggestedTechStack,
      ].join(", ")}\nComplexity: ${state.projectComplexity}`;
    }

    const planningPrompt = injectVariables(PROMPTS.SECTION_PLANNING, {
      prompt: state.userPrompt,
      context: projectContext,
    });

    const result = await llm.invoke({
      messages: [
        { role: "system", content: planningPrompt },
        { role: "user", content: "Create a dynamic section plan." },
      ],
      maxTokens: 800,
      temperature: 0.5,
    });

    const plan = parseJSON<{
      sections: Section[];
      reasoning: string;
      estimatedComplexity: "simple" | "moderate" | "complex";
    }>(result.content, {
      sections: [
        {
          title: "Overview",
          description: "Project overview and goals",
          intent: "Establish context",
          priority: 10,
        },
      ],
      reasoning: "Default plan",
      estimatedComplexity: "moderate",
    });

    const sortedSections = plan.sections.sort(
      (a, b) => b.priority - a.priority
    );

    const thinking: ThinkingResult = {
      reasoning: plan.reasoning,
      decisions: [`Planned ${sortedSections.length} sections dynamically`],
      assumptions: [],
      nextAction: "generate_sections",
    };

    return {
      sections: sortedSections,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed + classificationTokens,
      stepCount: state.stepCount + 1,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "Section planning failed",
      failedNode: "sectionPlanning",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * Section Generator Node - OPTIMIZED
 * FIX: Properly appends sections, uses reasoning cache
 */
export const sectionGeneratorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "sectionGenerator",
      stepCount: state.stepCount + 1,
    };
  }

  if (!state.sections || state.sections.length === 0) {
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
    return { stepCount: state.stepCount + 1 };
  }

  const currentSection = remaining[0];

  try {
    // Build lightweight context from previous sections (not full content)
    const previousSummary = state.planSections
      .map((s) => `- ${s.title}: ${s.content.slice(0, 100)}...`)
      .join("\n");

    // Reuse reasoning from previous thinking
    const lastThinking = state.thinkingHistory.slice(-1)[0]?.reasoning || "";

    const projectContext = `Category: ${
      state.projectCategory || "Unknown"
    }\nStack: ${[...state.detectedTechStack, ...state.suggestedTechStack].join(
      ", "
    )}\nComplexity: ${
      state.projectComplexity
    }\nPrevious reasoning: ${lastThinking}`;

    const generatorPrompt = injectVariables(PROMPTS.SECTION_GENERATOR, {
      sectionTitle: currentSection.title,
      sectionDescription: currentSection.description,
      sectionIntent: currentSection.intent,
      context: projectContext,
      previousSections: previousSummary || "None yet",
    });

    const inputTokens = estimateTokens(projectContext + state.userPrompt);
    const maxTokens = Math.min(
      1500,
      Math.max(800, Math.floor(inputTokens * 2))
    );

    const result = await llm.invoke({
      messages: [
        { role: "system", content: generatorPrompt },
        { role: "user", content: state.userPrompt },
      ],
      maxTokens,
      temperature: 0.7,
    });

    const newSection: PlanSection = {
      title: currentSection.title,
      content: result.content.trim(),
      order: state.planSections.length + 1,
    };

    const updatedGenerated = new Set(state.generatedSections);
    updatedGenerated.add(currentSection.title);

    const thinking: ThinkingResult = {
      reasoning: `Generated "${currentSection.title}"`,
      decisions: [
        `Section ${state.planSections.length + 1}/${state.sections.length}`,
      ],
      assumptions: [],
      nextAction:
        updatedGenerated.size < state.sections.length
          ? "generate_next_section"
          : "aggregate_plan",
    };

    // FIX: Append section instead of replacing
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
    return {
      lastError:
        error instanceof Error ? error.message : "Section generation failed",
      failedNode: "sectionGenerator",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * Plan Aggregator Node - OPTIMIZED
 */
export const planAggregatorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return {
      lastError: "Max steps exceeded",
      failedNode: "planAggregator",
      stepCount: state.stepCount + 1,
    };
  }

  if (state.planSections.length === 0) {
    return {
      lastError: "No sections generated",
      failedNode: "planAggregator",
      stepCount: state.stepCount + 1,
    };
  }

  try {
    const sorted = [...state.planSections].sort((a, b) => a.order - b.order);

    const sectionContent = sorted
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join("\n\n");

    const aggregatorPrompt = injectVariables(PROMPTS.PLAN_AGGREGATOR, {
      sections: sectionContent,
    });

    const result = await llm.invoke({
      messages: [
        { role: "system", content: aggregatorPrompt },
        { role: "user", content: "Finalize and format the plan." },
      ],
      maxTokens: 2000,
      temperature: 0.5,
    });

    let summary: string;
    try {
      summary = await contextMgr.generateSummary(result.content);
    } catch {
      summary = `${state.projectCategory || "Project"} plan with ${
        sorted.length
      } sections. Stack: ${[
        ...state.detectedTechStack,
        ...state.suggestedTechStack,
      ].join(", ")}`;
    }

    const thinking: ThinkingResult = {
      reasoning: "Plan aggregated and finalized",
      decisions: [`${sorted.length} sections combined`],
      assumptions: [],
      nextAction: "complete",
    };

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
    const sorted = [...state.planSections].sort((a, b) => a.order - b.order);
    const plan = [
      `# 🚀 Development Plan`,
      ``,
      `**Type:** ${state.projectCategory || "Unknown"}`,
      `**Stack:** ${[
        ...state.detectedTechStack,
        ...state.suggestedTechStack,
      ].join(", ")}`,
      `**Complexity:** ${state.projectComplexity}`,
      ``,
      `---`,
      ``,
      ...sorted.flatMap((s) => [`## ${s.title}`, ``, s.content, ``]),
    ].join("\n");

    return {
      finalPlan: plan,
      planSummary: `${state.projectCategory} with ${sorted.length} sections`,
      lastError: error instanceof Error ? error.message : "Aggregation warning",
      stepCount: state.stepCount + 1,
    };
  }
};

/**
 * Retry Handler Node - OPTIMIZED
 * Exponential backoff with proper routing
 */
export const retryHandlerNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const newRetryCount = state.retryCount + 1;

  if (newRetryCount > state.maxRetries) {
    return {
      retryCount: newRetryCount,
      lastError: `Max retries (${state.maxRetries}) exceeded. Last error: ${state.lastError}`,
      stepCount: state.stepCount + 1,
    };
  }

  // Exponential backoff: 1s, 2s, 4s, 8s (capped at 10s)
  const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
  await new Promise((resolve) => setTimeout(resolve, delay));

  const thinking: ThinkingResult = {
    reasoning: `Retry attempt ${newRetryCount}/${state.maxRetries} after ${delay}ms`,
    decisions: ["Retrying failed node"],
    assumptions: ["Error may be transient"],
    nextAction: `retry_${state.failedNode}`,
  };

  return {
    retryCount: newRetryCount,
    lastError: null, // Clear error to allow retry
    currentThinking: thinking,
    thinkingHistory: [thinking],
    stepCount: state.stepCount + 1,
  };
};
