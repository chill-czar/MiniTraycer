/**
 * Content Security Policy validation
 * Additional layer to detect sophisticated injection attempts
 */

interface CSPCheckResult {
  safe: boolean;
  reason?: string;
  severity?: "low" | "medium" | "high";
}

/**
 * Advanced pattern detection for sophisticated attacks
 */
const DANGEROUS_PATTERNS = [
  // JavaScript protocols
  {
    pattern: /javascript:/gi,
    reason: "JavaScript protocol detected",
    severity: "high" as const,
  },
  {
    pattern: /data:text\/html/gi,
    reason: "Data URI with HTML detected",
    severity: "high" as const,
  },
  {
    pattern: /vbscript:/gi,
    reason: "VBScript protocol detected",
    severity: "high" as const,
  },

  // Event handlers
  {
    pattern: /on(load|error|click|mouse|focus|blur|change|submit)=/gi,
    reason: "Event handler detected",
    severity: "high" as const,
  },

  // Script tags (various encodings)
  {
    pattern: /<script[\s\S]*?>/gi,
    reason: "Script tag detected",
    severity: "high" as const,
  },
  {
    pattern: /&lt;script/gi,
    reason: "Encoded script tag detected",
    severity: "medium" as const,
  },
  {
    pattern: /%3Cscript/gi,
    reason: "URL-encoded script tag detected",
    severity: "medium" as const,
  },

  // Dangerous tags
  {
    pattern: /<(iframe|embed|object|applet|meta|link|base)/gi,
    reason: "Dangerous HTML tag detected",
    severity: "high" as const,
  },

  // CSS expressions
  {
    pattern: /expression\s*\(/gi,
    reason: "CSS expression detected",
    severity: "medium" as const,
  },
  {
    pattern: /@import/gi,
    reason: "CSS @import detected",
    severity: "medium" as const,
  },

  // Unicode/encoding tricks
  {
    pattern: /\\u003c|\\x3c/gi,
    reason: "Escaped angle bracket detected",
    severity: "medium" as const,
  },

  // Template injection
  {
    pattern: /\{\{.*?\}\}/g,
    reason: "Template syntax detected",
    severity: "low" as const,
  },
  {
    pattern: /\$\{.*?\}/g,
    reason: "Template literal syntax detected",
    severity: "low" as const,
  },
];

/**
 * Validates content against CSP rules
 * @param content - Content to validate
 * @returns Validation result
 */
export function validateContentSecurityPolicy(content: string): CSPCheckResult {
  if (!content || typeof content !== "string") {
    return { safe: true };
  }

  // Check each dangerous pattern
  for (const { pattern, reason, severity } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      return {
        safe: false,
        reason,
        severity,
      };
    }
  }

  // Check for suspicious character sequences
  const suspiciousSequences = [
    { chars: "<<<", reason: "Multiple angle brackets detected" },
    { chars: ">>>", reason: "Multiple angle brackets detected" },
    { chars: "(){}[]", reason: "Excessive special characters detected" },
  ];

  for (const { chars, reason } of suspiciousSequences) {
    if (content.includes(chars)) {
      return {
        safe: false,
        reason,
        severity: "low",
      };
    }
  }

  // Check for base64-encoded content (potential payload hiding)
  const base64Pattern =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (content.length > 100 && base64Pattern.test(content.replace(/\s/g, ""))) {
    // Decode and check
    try {
      const decoded = Buffer.from(content, "base64").toString("utf-8");
      const decodedCheck = validateContentSecurityPolicy(decoded);
      if (!decodedCheck.safe) {
        return {
          safe: false,
          reason: `Base64-encoded content contains: ${decodedCheck.reason}`,
          severity: "high",
        };
      }
    } catch {
      // Not valid base64, continue
    }
  }

  return { safe: true };
}

/**
 * Checks if content contains polyglot payloads
 * (Valid in multiple contexts/languages)
 */
export function detectPolyglotPayload(content: string): boolean {
  const polyglotIndicators = [
    /javascript:.*<script/i, // JS + HTML
    /data:.*<script/i, // Data URI + HTML
    /<!--.*<script/i, // Comment + HTML
    /<svg.*<script/i, // SVG + HTML
  ];

  return polyglotIndicators.some((pattern) => pattern.test(content));
}

/**
 * Sanitizes URLs to prevent protocol-based attacks
 */
export function sanitizeURL(url: string): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  // Allowed protocols
  const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];

  try {
    const parsed = new URL(url);

    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    // Invalid URL
    return null;
  }
}
