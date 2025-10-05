// lib/pipeline/nodes.ts
import {
  PipelineState,
  ThinkingResult,
  PlanSection,
  ProjectCategory,
} from "@/types/generatePlan";
import { LLMInvoker } from "../utils/llmInvoker";
import { ContextManager } from "../utils/contextManager";
import { parseJSON } from "../utils/jsonParser";
import { PROMPTS } from "../utils/prompts";

const llm = new LLMInvoker();
const contextMgr = ContextManager.getInstance();

const buildMessages = (
  systemPrompt: string,
  state: PipelineState,
  userContent: string
) => {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (state.history.length > 0) {
    state.history.forEach((msg) => {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.summary || msg.content,
      });
    });
  }

  messages.push({ role: "user", content: userContent });
  return messages;
};

export const initialAnalysisNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return { lastError: "Max steps exceeded", failedNode: "initialAnalysis" };
  }

  const { estimatedTokens } = contextMgr.buildContext(
    state.prompt,
    state.history
  );

  try {
    const result = await llm.invoke({
      messages: buildMessages(PROMPTS.INITIAL_ANALYSIS, state, state.prompt),
      maxTokens: 500,
    });

    const analysis = parseJSON<{
      isVague: boolean;
      hasSufficientDetail: boolean;
      detectedIntent: string;
      missingInfo: string[];
      confidence: number;
    }>(result.content, {
      isVague:
        state.history.length === 0 && state.prompt.split(/\s+/).length < 10,
      hasSufficientDetail:
        state.history.length > 0 || state.prompt.split(/\s+/).length >= 15,
      detectedIntent: "project description",
      missingInfo: [],
      confidence: state.history.length > 0 ? 0.7 : 0.3,
    });

    const shouldClarify =
      analysis.isVague &&
      !analysis.hasSufficientDetail &&
      analysis.confidence < 0.4 &&
      analysis.missingInfo.length > 0;

    if (shouldClarify) {
      return {
        needsClarification: true,
        clarificationQuestions: analysis.missingInfo,
        modelUsed: result.modelUsed,
        totalTokensUsed: result.tokensUsed,
        currentThinking: {
          reasoning: `Low confidence: ${analysis.confidence}`,
          decisions: ["Request clarification"],
          assumptions: [],
          nextAction: "ask_clarification",
        },
      };
    }

    return {
      needsClarification: false,
      estimatedTokens,
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
      currentThinking: {
        reasoning: `Sufficient detail (confidence: ${analysis.confidence})`,
        decisions: ["Proceed with classification"],
        assumptions:
          analysis.confidence < 0.6 ? ["Making reasonable assumptions"] : [],
        nextAction: "classify_project",
      },
    };
  } catch (error) {
    return {
      lastError: error instanceof Error ? error.message : "Analysis failed",
      failedNode: "initialAnalysis",
    };
  }
};

export const classificationNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return { lastError: "Max steps exceeded", failedNode: "classification" };
  }

  try {
    const result = await llm.invoke({
      messages: buildMessages(PROMPTS.CLASSIFICATION, state, state.prompt),
      maxTokens: 600,
    });

    const classification = parseJSON<{
      category: ProjectCategory;
      detectedStack: string[];
      suggestedStack: string[];
      complexity: "simple" | "moderate" | "complex";
      reasoning: string;
    }>(result.content, {
      category: "web_app",
      detectedStack: [],
      suggestedStack: ["React", "Node.js", "PostgreSQL"],
      complexity: "moderate",
      reasoning: "Default classification",
    });

    const thinking: ThinkingResult = {
      reasoning: classification.reasoning,
      decisions: [
        `Category: ${classification.category}`,
        `Complexity: ${classification.complexity}`,
      ],
      assumptions:
        classification.detectedStack.length === 0
          ? [
              `Using suggested stack: ${classification.suggestedStack.join(
                ", "
              )}`,
            ]
          : [],
      nextAction: "determine_sections",
    };

    return {
      projectCategory: classification.category,
      detectedTechStack: classification.detectedStack,
      suggestedTechStack: classification.suggestedStack,
      projectComplexity: classification.complexity,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "Classification failed",
      failedNode: "classification",
    };
  }
};

export const sectionPlanningNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return { lastError: "Max steps exceeded", failedNode: "sectionPlanning" };
  }

  try {
    const result = await llm.invoke({
      messages: [
        { role: "system", content: PROMPTS.SECTION_PLANNING },
        {
          role: "user",
          content: `Category: ${state.projectCategory}
Stack: ${[...state.detectedTechStack, ...state.suggestedTechStack].join(", ")}
Complexity: ${state.projectComplexity}

Prompt: ${state.prompt}`,
        },
      ],
      maxTokens: 500,
    });

    const plan = parseJSON<{
      sections: string[];
      reasoning: string;
      priorityOrder: number[];
    }>(result.content, {
      sections: [
        "Overview",
        "Architecture",
        "Implementation Steps",
        "Tech Stack",
      ],
      reasoning: "Default sections",
      priorityOrder: [1, 2, 3, 4],
    });

    const thinking: ThinkingResult = {
      reasoning: plan.reasoning,
      decisions: [`${plan.sections.length} sections planned`],
      assumptions: [],
      nextAction: "generate_sections",
    };

    return {
      requiredSections: plan.sections,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "Section planning failed",
      failedNode: "sectionPlanning",
    };
  }
};

export const sectionGeneratorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return { lastError: "Max steps exceeded", failedNode: "sectionGenerator" };
  }

  const remaining = state.requiredSections.filter(
    (s) => !state.generatedSections.has(s)
  );

  if (remaining.length === 0) {
    return {};
  }

  const current = remaining[0];

  try {
    const previous = state.planSections
      .map((s) => `## ${s.title}\n${s.content}`)
      .join("\n\n");

    const result = await llm.invoke({
      messages: [
        { role: "system", content: PROMPTS.SECTION_GENERATOR },
        {
          role: "user",
          content: `Generate: ${current}

Category: ${state.projectCategory}
Stack: ${[...state.detectedTechStack, ...state.suggestedTechStack].join(", ")}
Complexity: ${state.projectComplexity}

Prompt: ${state.prompt}

${previous ? `Previous:\n${previous}` : ""}`,
        },
      ],
      maxTokens: 1200,
    });

    const newSection: PlanSection = {
      title: current,
      content: result.content.trim(),
      order: state.planSections.length + 1,
    };

    const updatedGenerated = new Set(state.generatedSections);
    updatedGenerated.add(current);

    const thinking: ThinkingResult = {
      reasoning: `Generated "${current}"`,
      decisions: [`${result.content.split("\n").length} lines`],
      assumptions: [],
      nextAction:
        updatedGenerated.size < state.requiredSections.length
          ? "generate_next_section"
          : "aggregate_plan",
    };

    return {
      planSections: [newSection],
      generatedSections: updatedGenerated,
      currentThinking: thinking,
      thinkingHistory: [thinking],
      modelUsed: result.modelUsed,
      totalTokensUsed: result.tokensUsed,
    };
  } catch (error) {
    return {
      lastError:
        error instanceof Error ? error.message : "Section generation failed",
      failedNode: "sectionGenerator",
    };
  }
};

export const planAggregatorNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  if (state.stepCount >= state.maxSteps) {
    return { lastError: "Max steps exceeded", failedNode: "planAggregator" };
  }

  if (state.planSections.length === 0) {
    return { lastError: "No sections generated", failedNode: "planAggregator" };
  }

  const sorted = [...state.planSections].sort((a, b) => a.order - b.order);

  const plan = [
    `# 🚀 Development Plan`,
    ``,
    `**Type:** ${state.projectCategory}`,
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

  try {
    const summary = await contextMgr.generateSummary(plan);

    const thinking: ThinkingResult = {
      reasoning: "Plan aggregated and summarized",
      decisions: [
        `${sorted.length} sections`,
        `Summary: ${summary.length} chars`,
      ],
      assumptions: [],
      nextAction: "complete",
    };

    return {
      finalPlan: plan,
      planSummary: summary,
      currentThinking: thinking,
      thinkingHistory: [thinking],
    };
  } catch {
    
    const fallback = `${state.projectCategory} project using ${[
      ...state.detectedTechStack,
      ...state.suggestedTechStack,
    ].join(", ")}. Complexity: ${state.projectComplexity}`;

    return {
      finalPlan: plan,
      planSummary: fallback,
      currentThinking: {
        reasoning: "Plan aggregated with fallback summary",
        decisions: ["Used fallback summary"],
        assumptions: [],
        nextAction: "complete",
      },
    };
  }
};

export const retryHandlerNode = async (
  state: PipelineState
): Promise<Partial<PipelineState>> => {
  const newRetryCount = state.retryCount + 1;

  if (newRetryCount > state.maxRetries) {
    return {
      retryCount: newRetryCount,
      lastError: `Max retries exceeded. Last error: ${state.lastError}`,
    };
  }

  return {
    retryCount: newRetryCount,
    lastError: null,
  };
};
