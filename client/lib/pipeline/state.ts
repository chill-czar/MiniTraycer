// lib/pipeline/state.ts
import { Annotation } from "@langchain/langgraph";
import { ChatMessage, PlanSection, ThinkingResult } from "@/types/domain";

/**
 * Core state interface for the dynamic LangGraph pipeline
 * Supports general responses, chatbot flows, and builder/planning flows
 */
export interface PipelineState {
  // Core Input
  userPrompt: string;
  history: ChatMessage[];

  // Dynamic Classification
  promptType?: "general" | "chatbot" | "builder" | "unclear";
  intentConfidence?: number;
  detectedIntent?: string;

  // Clarification Flow
  needsClarification: boolean;
  clarificationQuestions: string[];
  clarifiedPrompt?: string;

  // Context Management
  contextSummary: string | null;
  estimatedTokens: number;
  conversationContext?: string; // For chatbot flow

  // Builder/Plan Flow
  sections?: Section[];
  generatedSections: Set<string>;
  planSections: PlanSection[];
  finalPlan: string | null;
  planSummary: string | null;

  // General/Chatbot Response Flow
  finalResponse?: string; // For general/chatbot responses
  responseMetadata?: ResponseMetadata;

  // Tools & Resources
  toolsUsed: string[];
  toolResults?: ToolResult[];

  // Project Classification (Builder flow)
  projectCategory?: string;
  detectedTechStack: string[];
  suggestedTechStack: string[];
  projectComplexity: "simple" | "moderate" | "complex";

  // Reasoning & Thinking
  currentThinking: ThinkingResult | null;
  thinkingHistory: ThinkingResult[];

  // System State
  modelUsed: string;
  totalTokensUsed: number;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  failedNode: string | null;
  stepCount: number;
  maxSteps: number;
}

export interface Section {
  title: string;
  description: string;
  intent: string;
  priority: number;
}

export interface ResponseMetadata {
  responseType: "factual" | "conversational" | "structured";
  sourcesUsed: string[];
  confidence: number;
}

export interface ToolResult {
  tool: string;
  query: string;
  result: string;
  timestamp: number;
}

/**
 * LangGraph State Annotation with optimized reducers
 */
export const PipelineStateAnnotation = Annotation.Root({
  // Core Input
  userPrompt: Annotation<string>,
  history: Annotation<ChatMessage[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),

  // Dynamic Classification
  promptType: Annotation<
    "general" | "chatbot" | "builder" | "unclear" | undefined
  >({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),
  intentConfidence: Annotation<number | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),
  detectedIntent: Annotation<string | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),

  // Clarification
  needsClarification: Annotation<boolean>({
    reducer: (_prev, newVal) => newVal,
    default: () => false,
  }),
  clarificationQuestions: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  clarifiedPrompt: Annotation<string | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),

  // Context Management
  contextSummary: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  estimatedTokens: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 0,
  }),
  conversationContext: Annotation<string | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),

  // Builder/Plan Flow
  sections: Annotation<Section[] | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),
  generatedSections: Annotation<Set<string>>({
    reducer: (_prev, newVal) => newVal,
    default: () => new Set<string>(),
  }),
  planSections: Annotation<PlanSection[]>({
    reducer: (prev, newVal) => [...prev, ...newVal],
    default: () => [],
  }),
  finalPlan: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  planSummary: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),

  // General/Chatbot Response
  finalResponse: Annotation<string | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),
  responseMetadata: Annotation<ResponseMetadata | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),

  // Tools
  toolsUsed: Annotation<string[]>({
    reducer: (prev, newVal) => [...prev, ...newVal],
    default: () => [],
  }),
  toolResults: Annotation<ToolResult[] | undefined>({
    reducer: (prev, newVal) => [...(prev || []), ...(newVal || [])],
    default: () => undefined,
  }),

  // Project Classification
  projectCategory: Annotation<string | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),
  detectedTechStack: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  suggestedTechStack: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  projectComplexity: Annotation<"simple" | "moderate" | "complex">({
    reducer: (_prev, newVal) => newVal,
    default: () => "moderate",
  }),

  // Reasoning
  currentThinking: Annotation<ThinkingResult | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  thinkingHistory: Annotation<ThinkingResult[]>({
    reducer: (prev, newVal) => [...prev, ...newVal],
    default: () => [],
  }),

  // System State
  modelUsed: Annotation<string>({
    reducer: (_prev, newVal) => newVal,
    default: () => "",
  }),
  totalTokensUsed: Annotation<number>({
    reducer: (prev, newVal) => prev + newVal,
    default: () => 0,
  }),
  retryCount: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 3,
  }),
  lastError: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  failedNode: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  stepCount: Annotation<number>({
    reducer: (prev) => prev + 1,
    default: () => 0,
  }),
  maxSteps: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 50,
  }),
});

/**
 * Utility to trim state for token optimization
 */
export const trimStateForNode = (
  state: PipelineState,
  nodeType: string
): Partial<PipelineState> => {
  const base = {
    userPrompt: state.userPrompt,
    promptType: state.promptType,
    stepCount: state.stepCount,
    maxSteps: state.maxSteps,
  };

  switch (nodeType) {
    case "classification":
      return {
        ...base,
        history: state.history.slice(-3), // Keep last 3 messages
        contextSummary: state.contextSummary,
      };

    case "general":
    case "chatbot":
      return {
        ...base,
        history: state.history.slice(-5),
        conversationContext: state.conversationContext,
        toolsUsed: state.toolsUsed,
      };

    case "builder":
      return {
        ...base,
        projectCategory: state.projectCategory,
        detectedTechStack: state.detectedTechStack,
        suggestedTechStack: state.suggestedTechStack,
        sections: state.sections,
        generatedSections: state.generatedSections,
      };

    default:
      return base;
  }
};
