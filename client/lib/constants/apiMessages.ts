/**
 * Centralized API error messages
 * These are safe to show to end users
 */
export const API_ERROR_MESSAGES = {
  // Request validation
  INVALID_REQUEST: "Invalid request format",
  INVALID_JSON: "Request body must be valid JSON",
  PAYLOAD_TOO_LARGE: "Request payload exceeds size limit",

  // Input validation
  INVALID_PROMPT: "Invalid prompt provided",
  PROMPT_TOO_SHORT: "Prompt is too short",
  PROMPT_TOO_LONG: "Prompt exceeds character limit",
  EMPTY_PROMPT: "Prompt cannot be empty",

  // History validation
  INVALID_HISTORY: "Invalid message history format",
  HISTORY_TOO_LARGE: "Message history exceeds limit",

  // Security
  UNSAFE_CONTENT: "Request contains potentially unsafe content",
  SUSPICIOUS_PATTERN: "Request contains suspicious patterns",
  SQL_INJECTION_DETECTED: "Request contains SQL-like patterns",
  XSS_DETECTED: "Request contains script-like patterns",

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later",

  // Server errors
  INTERNAL_ERROR: "An internal error occurred. Please try again",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  TIMEOUT: "Request timed out. Please try again",

  // Pipeline errors
  PIPELINE_ERROR: "Failed to process request",
  AI_SERVICE_ERROR: "AI service is temporarily unavailable",
} as const;

/**
 * Internal error codes (for logging, not shown to users)
 */
export const INTERNAL_ERROR_CODES = {
  VALIDATION_FAILED: "ERR_VALIDATION",
  SANITIZATION_FAILED: "ERR_SANITIZATION",
  RATE_LIMIT_CHECK_FAILED: "ERR_RATE_LIMIT",
  PIPELINE_EXECUTION_FAILED: "ERR_PIPELINE",
  DATABASE_ERROR: "ERR_DATABASE",
  EXTERNAL_API_ERROR: "ERR_EXTERNAL_API",
  UNKNOWN_ERROR: "ERR_UNKNOWN",
} as const;
