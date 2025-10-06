import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";
import { GeneratePlanRequest } from "@/types/api";

// Message schema (for history)
const messageSchema = z.object({
  role: z.enum(["user", "assistant"], {
    errorMap: () => ({ message: "Role must be either 'user' or 'assistant'" }),
  }),
  content: z
    .string()
    .min(1, "Message content cannot be empty")
    .max(10000, "Message content exceeds 10000 character limit"),
  summary: z
    .string()
    .max(2000, "Summary exceeds 2000 character limit")
    .optional(),
});

// Main request schema
export const generatePlanRequestSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(5000, "Prompt exceeds 5000 character limit")
    .refine(
      (val) => val.trim().length > 0,
      "Prompt cannot contain only whitespace"
    )
    .refine((val) => {
      // Only block obvious SQL injection attempts in actual query context
      const dangerousSqlPatterns = [
        /;\s*(DROP|DELETE|TRUNCATE)\s+(TABLE|DATABASE)/gi,
        /'.*OR.*'.*=.*'/gi,
        /UNION.*SELECT.*FROM/gi,
      ];
      return !dangerousSqlPatterns.some((pattern) => pattern.test(val));
    }, "Prompt contains potentially harmful SQL patterns")
    .refine((val) => {
      // More lenient NoSQL check - only block obvious injection
      const dangerousNoSqlPatterns = [
        /\{\s*\$where\s*:/gi,
        /\{\s*\$ne\s*:\s*null\s*\}/gi,
      ];
      return !dangerousNoSqlPatterns.some((pattern) => pattern.test(val));
    }, "Prompt contains potentially harmful NoSQL patterns")
    .refine((val) => {
      // Only block obvious command injection with dangerous commands
      const cmdPatterns = [
        /[;&|`]\s*(rm|curl|wget|bash|sh|powershell|cmd|eval)/gi,
      ];
      return !cmdPatterns.some((pattern) => pattern.test(val));
    }, "Prompt contains potentially harmful command patterns")
    .refine((val) => {
      // Check for excessive path traversal (multiple instances)
      const traversalMatches = val.match(/\.\.[\/\\]/g);
      return !traversalMatches || traversalMatches.length < 3;
    }, "Prompt contains excessive path traversal patterns"),

  history: z
    .array(messageSchema)
    .max(100, "History cannot exceed 100 messages")
    .optional(),
});

export type ValidatedGeneratePlanRequest = z.infer<
  typeof generatePlanRequestSchema
>;

/**
 * Validates the incoming API request
 * @param data - Raw request body
 * @returns Validation result
 */
export function validateGeneratePlanRequest(data: unknown) {
  return generatePlanRequestSchema.safeParse(data);
}

/**
 * Sanitizes a single message
 * @param message - Raw message
 * @returns Sanitized message
 */
function sanitizeMessage(message: {
  role: string;
  content: string;
  summary?: string;
}) {
  return {
    role: message.role as "user" | "assistant",
    content: sanitizeText(message.content),
    summary: message.summary ? sanitizeText(message.summary) : undefined,
  };
}

/**
 * Sanitizes text content
 * @param text - Raw text
 * @returns Sanitized text
 */
function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Remove null bytes and most control characters (but keep newlines and tabs)
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Use DOMPurify for XSS protection - allow more formatting tags
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "code",
      "pre",
      "br",
      "p",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
    ],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // Don't normalize whitespace too aggressively - keep formatting
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitizes the entire request after validation
 * @param request - Validated request
 * @returns Sanitized request
 */
export function sanitizeGeneratePlanRequest(
  request: ValidatedGeneratePlanRequest
): GeneratePlanRequest {
  return {
    prompt: sanitizeText(request.prompt),
    history: request.history?.map(sanitizeMessage),
  };
}

/**
 * Sanitizes API response before sending to client
 * @param response - Raw API response
 * @returns Sanitized response
 */
export function sanitizeOutput(response: any): any {
  if (!response || typeof response !== "object") {
    return response;
  }

  const sanitized: any = {
    success: Boolean(response.success),
    needsClarification: Boolean(response.needsClarification),
  };

  // Sanitize message if present
  if (response.message && typeof response.message === "string") {
    sanitized.message = sanitizeText(response.message);
  }

  // Sanitize data object if present
  if (response.data && typeof response.data === "object") {
    sanitized.data = {
      markdown: response.data.markdown
        ? sanitizeText(response.data.markdown)
        : undefined,
      summary: response.data.summary
        ? sanitizeText(response.data.summary)
        : undefined,
      metadata: response.data.metadata || undefined,
    };
  } else {
    sanitized.data = null;
  }

  return sanitized;
}

/**
 * Validates that a string doesn't contain suspicious patterns
 * @param input - Input string
 * @returns Validation result
 */
export function containsSuspiciousPatterns(input: string): {
  suspicious: boolean;
  patterns: string[];
} {
  const suspiciousPatterns = [
    {
      name: "SQL Injection",
      regex: /;\s*(DROP|DELETE|TRUNCATE)\s+(TABLE|DATABASE)/gi,
    },
    { name: "XSS", regex: /<script[\s\S]*?>[\s\S]*?<\/script>/gi },
    {
      name: "Command Injection",
      regex: /[;&|`]\s*(rm|curl|wget|bash|sh|powershell|cmd|eval)/gi,
    },
    { name: "Path Traversal", regex: /(\.\.[\/\\]){3,}/g },
  ];

  const found: string[] = [];

  for (const pattern of suspiciousPatterns) {
    if (pattern.regex.test(input)) {
      found.push(pattern.name);
    }
  }

  return {
    suspicious: found.length > 0,
    patterns: found,
  };
}
