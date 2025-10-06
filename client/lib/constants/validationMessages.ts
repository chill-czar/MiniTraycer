/**
 * Centralized validation error messages
 * Makes it easy to update messaging across the app
 */
export const VALIDATION_MESSAGES = {
  // Chat Input
  MESSAGE_REQUIRED: "Please enter a message before sending",
  MESSAGE_TOO_SHORT: "Message is too short. Please provide more details",
  MESSAGE_TOO_LONG: "Message exceeds 5000 character limit",
  INVALID_INPUT: "Invalid input provided",
  INVALID_CONTENT: "Message contains only invalid or unsafe content",

  // Security
  DANGEROUS_CONTENT: "Message contains potentially harmful content",
  TOO_MANY_SPECIAL_CHARS: "Message contains too many special characters",
  INVALID_CHARACTERS: "Message contains invalid characters",

  // General
  NETWORK_ERROR: "Network error. Please check your connection",
  SERVER_ERROR: "Server error. Please try again later",
  UNKNOWN_ERROR: "An unexpected error occurred",
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: "Message sent successfully",
  PLAN_GENERATED: "Plan generated successfully",
  DATA_SAVED: "Data saved successfully",
} as const;

/**
 * Info messages
 */
export const INFO_MESSAGES = {
  CLARIFICATION_NEEDED: "Please provide more information to continue",
  PROCESSING: "Processing your request...",
} as const;
