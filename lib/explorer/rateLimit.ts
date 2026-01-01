/**
 * Simple rate limiter for explorer API routes
 * 
 * In-memory rate limiting: 60 requests per minute per IP.
 * Ephemeral (resets on server restart).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp in milliseconds
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit: 60 requests per minute per IP
 */
const RATE_LIMIT_REQUESTS = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string {
  // Try various headers (Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  // Fallback (shouldn't happen in production)
  return 'unknown';
}

/**
 * Check if request should be rate limited
 * 
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(request: Request): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const ip = getClientIP(request);
  const now = Date.now();

  // Get or create entry
  let entry = rateLimitStore.get(ip);

  // Reset if window expired
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(ip, entry);
  }

  // Increment count
  entry.count += 1;

  // Check limit
  const allowed = entry.count <= RATE_LIMIT_REQUESTS;
  const remaining = Math.max(0, RATE_LIMIT_REQUESTS - entry.count);

  // Cleanup old entries periodically (every 5 minutes)
  if (Math.random() < 0.01) {
    // 1% chance to cleanup on each request
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetAt + RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.delete(key);
      }
    }
  }

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

