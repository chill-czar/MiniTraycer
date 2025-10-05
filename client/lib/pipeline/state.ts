// lib/pipeline/state.ts
import { Annotation } from "@langchain/langgraph";
import {
  ChatMessage,
  ThinkingResult,
  PlanSection,
  ProjectCategory,
} from "@/types/generatePlan";

export const PipelineStateAnnotation = Annotation.Root({
  prompt: Annotation<string>,
  history: Annotation<ChatMessage[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  contextSummary: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  estimatedTokens: Annotation<number>({
    reducer: (_prev, newVal) => newVal,
    default: () => 0,
  }),
  needsClarification: Annotation<boolean>({
    reducer: (_prev, newVal) => newVal,
    default: () => false,
  }),
  clarificationQuestions: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  projectCategory: Annotation<ProjectCategory>({
    reducer: (_prev, newVal) => newVal,
    default: () => "unknown" as ProjectCategory,
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
  planSections: Annotation<PlanSection[]>({
    reducer: (prev, newVal) => [...prev, ...newVal],
    default: () => [],
  }),
  requiredSections: Annotation<string[]>({
    reducer: (_prev, newVal) => newVal,
    default: () => [],
  }),
  generatedSections: Annotation<Set<string>>({
    reducer: (_prev, newVal) => newVal,
    default: () => new Set<string>(),
  }),
  finalPlan: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
  }),
  planSummary: Annotation<string | null>({
    reducer: (_prev, newVal) => newVal,
    default: () => null,
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
