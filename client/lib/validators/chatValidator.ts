import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

// Validation Schema using Zod
export const chatInputSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message must be less than 5000 characters")
    .refine(
      (val) => val.trim().length > 0,
      "Message cannot contain only whitespace"
    )
    .refine((val) => {
      // Check for excessive special characters (potential obfuscation attacks)
      const specialCharCount = (val.match(/[<>{}[\]\\|`]/g) || []).length;
      return specialCharCount < val.length * 0.3; // Max 30% special chars
    }, "Message contains too many special characters")
    .refine((val) => {
      // Block common script injection patterns
      const dangerousPatterns = [
        /<script[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // onclick, onload, etc.
        /<iframe/gi,
        /<embed/gi,
        /<object/gi,
        /data:text\/html/gi,
      ];
      return !dangerousPatterns.some((pattern) => pattern.test(val));
    }, "Message contains potentially harmful content")
    .refine((val) => {
      // Prevent excessive newlines (flooding)
      const newlineCount = (val.match(/\n/g) || []).length;
      return newlineCount < 100;
    }, "Message contains too many line breaks")
    .refine((val) => {
      // Check for null bytes (can bypass some filters)
      return !val.includes("\0");
    }, "Message contains invalid characters"),
});

// Type inference from schema
export type ChatInputData = z.infer<typeof chatInputSchema>;

/**
 * Validates chat input using Zod schema
 * @param message - Raw message input
 * @returns Validation result with data or error
 */
export function validateChatInput(message: string) {
  return chatInputSchema.safeParse({ message });
}

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input - Raw input string
 * @returns Sanitized string safe for rendering
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Step 1: Trim whitespace
  let sanitized = input.trim();

  // Step 2: Remove null bytes and control characters (except newlines, tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Step 3: Use DOMPurify to remove XSS vectors
  // Allow basic text formatting but strip dangerous tags/attributes
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "code", "pre", "br"],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });

  // Step 4: Decode HTML entities to prevent double-encoding issues
  sanitized = decodeHTMLEntities(sanitized);

  // Step 5: Normalize whitespace (collapse multiple spaces)
  sanitized = sanitized.replace(/ {2,}/g, " ");

  // Step 6: Limit consecutive newlines
  sanitized = sanitized.replace(/\n{4,}/g, "\n\n\n");

  return sanitized;
}

/**
 * Decodes common HTML entities
 * @param text - Text with HTML entities
 * @returns Decoded text
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#x27;": "'",
    "&#x2F;": "/",
  };

  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Escapes HTML for safe rendering in text contexts
 * Use this if you need to display user input as plain text
 * @param text - Raw text
 * @returns Escaped text
 */
export function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return text.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Validates and sanitizes in one step (convenience function)
 * @param input - Raw input
 * @returns Sanitized input or null if invalid
 */
export function validateAndSanitize(
  input: string
): { success: true; data: string } | { success: false; error: string } {
  const validation = validateChatInput(input);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || "Invalid input",
    };
  }

  const sanitized = sanitizeInput(validation.data.message);

  if (!sanitized.trim()) {
    return {
      success: false,
      error: "Input resulted in empty content after sanitization",
    };
  }

  return {
    success: true,
    data: sanitized,
  };
}
