// types/generatePlan.ts

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface generatePlanRequest {
  prompt: string;
  history: ChatMessage[];
}
export type ProjectCategory =
  | "web_app"
  | "api_service"
  | "mobile_app"
  | "data_pipeline"
  | "infrastructure"
  | "library"
  | "ml_system"
  | "realtime_system"
  | "content_platform"
  | "unknown";


export interface PlanMetadata {
  generated_at: string;
  retryCount: number;
  maxRetries: number;
  classification: ProjectCategory
}

export interface PlanData {
  markdown: string;
  metadata: PlanMetadata;
}

export interface generatePlanResponse {
  success: boolean;
  data?: PlanData | null;
  message?: string;
  needsClarification?: boolean;
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
