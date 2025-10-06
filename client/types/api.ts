// types/api.ts
// API request/response types and external interface types

import { ChatMessage, PlanData } from "./domain";

export interface GeneratePlanRequest {
  prompt: string;
  history?: ChatMessage[];
}

export interface GeneratePlanResponse {
  success: boolean;
  data: PlanData | null;
  message?: string;
  needsClarification?: boolean;
}

export interface ModelLimits {
  rpm: number;
  rpd: number;
  tpm: number;
  tpd: number;
}

export interface RateLimitMetrics {
  rpm: number;
  rpd: number;
  tpm: number;
  tpd: number;
  lastReset: number;
}

export interface APIKeyInfo {
  key: string;
  status: "active" | "cooldown" | "failed";
  usage: RateLimitMetrics;
}

export interface ModelConfig {
  modelName: string;
  apiKeys: APIKeyInfo[];
  priority: number;
  limits: ModelLimits;
}

export interface LLMInvokeOptions {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMInvokeResult {
  content: string;
  modelUsed: string;
  tokensUsed: number;
}
