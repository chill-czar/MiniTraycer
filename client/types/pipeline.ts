import { ChatMessage, PlanSection, ThinkingResult } from "./domain";

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


export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}
