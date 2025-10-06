// types/domain.ts
// Core domain types representing business concepts

export type ProjectCategory =
  | "web_app"
  | "mobile_app"
  | "api"
  | "cli_tool"
  | "library"
  | "data_pipeline"
  | "ml_model"
  | "utility"
  | "unknown";

export type ProjectComplexity = "simple" | "moderate" | "complex";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  summary?: string;
}

export interface PlanSection {
  title: string;
  content: string;
  order: number;
}

export interface ThinkingResult {
  reasoning: string;
  decisions: string[];
  assumptions: string[];
  nextAction: string;
}

export interface PlanMetadata {
  generated_at: string;
  classification: ProjectCategory;
  model_used: string;
  total_tokens: number;
  summary: string;
}

export interface PlanData {
  markdown: string;
  summary: string;
  metadata: PlanMetadata;
}
