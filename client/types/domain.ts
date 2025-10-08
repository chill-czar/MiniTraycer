// types/domain.ts - Core domain types

export type ProjectCategory =
  | "web_app"
  | "mobile_app"
  | "api"
  | "cli_tool"
  | "library"
  | "data_pipeline"
  | "ml_model"
  | "infrastructure"
  | "utility"
  | "general_project"
  | "unknown";

export type ProjectComplexity = "simple" | "moderate" | "complex";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  summary?: string;
  timestamp?: string;
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
  classification: ProjectCategory | string;
  model_used: string;
  total_tokens: number;
  summary: string;
}

export interface PlanData {
  markdown: string;
  summary: string;
  metadata: PlanMetadata;
}

export interface ResponseMetadata {
  responseType: "factual" | "conversational" | "structured" | "plan";
  sourcesUsed: string[];
  confidence: number;
}

export interface ToolResult {
  tool: string;
  query: string;
  result: string;
  timestamp: number;
}
