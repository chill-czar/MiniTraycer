import { Annotation } from "@langchain/langgraph";
import { ChatMessage, PlanSection, ThinkingResult } from "@/types/domain";

export interface Section {
  title: string;
  description: string;
  intent: string;
  priority: number;
}

export interface PipelineState {
  userPrompt: string;
  history: ChatMessage[];
  needsClarification: boolean;
  clarificationQuestions: string[];
  clarifiedPrompt?: string;
  intentConfidence?: number;
  contextSummary: string | null;
  estimatedTokens: number;
  sections?: Section[];
  generatedSections: Set<string>;
  planSections: PlanSection[];
  finalPlan: string | null;
  planSummary: string | null;
  projectCategory?: string;
  detectedTechStack: string[];
  suggestedTechStack: string[];
  projectComplexity: "simple" | "moderate" | "complex";
  currentThinking: ThinkingResult | null;
  thinkingHistory: ThinkingResult[];
  modelUsed: string;
  totalTokensUsed: number;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  failedNode: string | null;
  stepCount: number;
  maxSteps: number;
}

export const PipelineStateAnnotation = Annotation.Root({
  userPrompt: Annotation<string>,
  history: Annotation<ChatMessage[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
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
  intentConfidence: Annotation<number | undefined>({
    reducer: (_prev, newVal) => newVal,
    default: () => undefined,
  }),
  contextSummary: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  estimatedTokens: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 0,
  }),
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
  currentThinking: Annotation<ThinkingResult | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  thinkingHistory: Annotation<ThinkingResult[]>({
    reducer: (prev, newVal) => [...prev, ...newVal],
    default: () => [],
  }),
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
