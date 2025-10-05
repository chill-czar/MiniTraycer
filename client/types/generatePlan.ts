// types/generatePlan.ts

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface generatePlanRequest {
  prompt: string;
  history: ChatMessage[];
}

export interface PlanMetadata {
  generated_at: string;
  retryCount: number;
  maxRetries: number;
  classification:
    | "frontend"
    | "backend"
    | "fullstack"
    | "library"
    | "infra"
    | "other"
    | "unknown";
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
