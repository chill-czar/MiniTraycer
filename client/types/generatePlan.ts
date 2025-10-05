// types/generatePlan.ts
export type ProjectCategory =
  | "web_app"
  | "mobile_app"
  | "api"
  | "cli_tool"
  | "library"
  | "data_pipeline"
  | "ml_model"
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

export interface PipelineState {
  prompt: string;
  history: ChatMessage[];
  contextSummary: string | null;
  estimatedTokens: number;
  needsClarification: boolean;
  clarificationQuestions: string[];
  projectCategory: ProjectCategory;
  detectedTechStack: string[];
  suggestedTechStack: string[];
  projectComplexity: ProjectComplexity;
  currentThinking: ThinkingResult | null;
  thinkingHistory: ThinkingResult[];
  planSections: PlanSection[];
  requiredSections: string[];
  generatedSections: Set<string>;
  finalPlan: string | null;
  planSummary: string | null;
  modelUsed: string;
  totalTokensUsed: number;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  failedNode: string | null;
  stepCount: number;
  maxSteps: number;
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
