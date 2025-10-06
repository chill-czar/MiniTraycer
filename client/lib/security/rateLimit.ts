/**
 * Simple in-memory rate limiter
 * For production, use Redis or a dedicated service like Upstash
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Store rate limit data (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
};

/**
 * Check if request should be rate limited
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @returns Rate limit result
 */
export async function rateLimit(identifier: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  retryAfter?: number;
}> {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired entries periodically (simple cleanup)
  if (Math.random() < 0.01) {
    cleanupExpiredRecords(now);
  }

  // No record exists or record expired
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    });

    return {
      success: true,
      limit: RATE_LIMIT_CONFIG.maxRequests,
      remaining: RATE_LIMIT_CONFIG.maxRequests - 1,
    };
  }

  // Check if limit exceeded
  if (record.count >= RATE_LIMIT_CONFIG.maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);

    return {
      success: false,
      limit: RATE_LIMIT_CONFIG.maxRequests,
      remaining: 0,
      retryAfter,
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(identifier, record);

  return {
    success: true,
    limit: RATE_LIMIT_CONFIG.maxRequests,
    remaining: RATE_LIMIT_CONFIG.maxRequests - record.count,
  };
}

/**
 * Clean up expired rate limit records
 * @param now - Current timestamp
 */
function cleanupExpiredRecords(now: number): void {
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Reset rate limit for a specific identifier (useful for testing)
 * @param identifier - Identifier to reset
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status without incrementing
 * @param identifier - Identifier to check
 * @returns Current status
 */
export function getRateLimitStatus(identifier: string): {
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    return {
      limit: RATE_LIMIT_CONFIG.maxRequests,
      remaining: RATE_LIMIT_CONFIG.maxRequests,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    };
  }

  return {
    limit: RATE_LIMIT_CONFIG.maxRequests,
    remaining: Math.max(0, RATE_LIMIT_CONFIG.maxRequests - record.count),
    resetTime: record.resetTime,
  };
}
