import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import {
  validateGeneratePlanRequest,
  sanitizeGeneratePlanRequest,
  sanitizeOutput,
} from "@/lib/validators/apiValidator";
import { API_ERROR_MESSAGES } from "@/lib/constants/apiMessages";
import { rateLimit } from "@/lib/security/rateLimit";
import { validateContentSecurityPolicy } from "@/lib/security/csp";

// Request size limit (10MB)
const MAX_REQUEST_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestId: string | undefined;

  try {
    // 1. Generate request ID for logging/tracing
    requestId = crypto.randomUUID();

    // 2. Check Content-Length to prevent large payloads
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      console.warn(`[${requestId}] Request too large: ${contentLength} bytes`);
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: API_ERROR_MESSAGES.PAYLOAD_TOO_LARGE,
        },
        { status: 413 }
      );
    }

    // 3. Rate limiting (by IP address)
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitResult = await rateLimit(ip);
    if (!rateLimitResult.success) {
      console.warn(`[${requestId}] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: API_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
            "X-RateLimit-Limit": rateLimitResult.limit?.toString() || "10",
            "X-RateLimit-Remaining":
              rateLimitResult.remaining?.toString() || "0",
          },
        }
      );
    }

    // 4. Parse request body with error handling
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      console.error(`[${requestId}] JSON parse error:`, error);
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: API_ERROR_MESSAGES.INVALID_JSON,
        },
        { status: 400 }
      );
    }

    // 5. Validate request structure and types
    const validation = validateGeneratePlanRequest(body);

    if (!validation.success) {
      const errorMessage =
        validation.error.errors[0]?.message ||
        API_ERROR_MESSAGES.INVALID_REQUEST;

      console.warn(`[${requestId}] Validation failed:`, {
        errors: validation.error.errors,
        ip,
      });

      return NextResponse.json(
        {
          success: false,
          data: null,
          message: errorMessage,
        },
        { status: 400 }
      );
    }

    // 6. Sanitize validated input
    const sanitizedRequest = sanitizeGeneratePlanRequest(validation.data);

    // 7. Additional security check: CSP validation
    const cspCheck = validateContentSecurityPolicy(sanitizedRequest.prompt);
    if (!cspCheck.safe) {
      console.warn(`[${requestId}] CSP violation detected:`, {
        reason: cspCheck.reason,
        ip,
      });

      return NextResponse.json(
        {
          success: false,
          data: null,
          message: API_ERROR_MESSAGES.UNSAFE_CONTENT,
        },
        { status: 400 }
      );
    }

    // 8. Log request (sanitized) for monitoring
    console.info(`[${requestId}] Processing request:`, {
      promptLength: sanitizedRequest.prompt.length,
      historyLength: sanitizedRequest.history?.length || 0,
      ip,
      timestamp: new Date().toISOString(),
    });

    // 9. Execute pipeline with sanitized input
    const response = await runPipeline(sanitizedRequest);

    // 10. Sanitize output before sending to client
    const sanitizedResponse = sanitizeOutput(response);

    // 11. Log response
    const duration = Date.now() - startTime;
    console.info(`[${requestId}] Request completed:`, {
      success: sanitizedResponse.success,
      duration: `${duration}ms`,
      needsClarification: sanitizedResponse.needsClarification,
    });

    // 12. Return sanitized response
    return NextResponse.json(sanitizedResponse, {
      status: sanitizedResponse.success ? 200 : 400,
      headers: {
        "X-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    // Handle unexpected errors
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Unexpected error:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
    });

    // Don't expose internal error details to client
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: API_ERROR_MESSAGES.INTERNAL_ERROR,
        ...(process.env.NODE_ENV === "development" && {
          debug: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      {
        status: 500,
        headers: {
          "X-Request-ID": requestId || "unknown",
        },
      }
    );
  }
}

// Optional: Add OPTIONS handler for CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  });
}
