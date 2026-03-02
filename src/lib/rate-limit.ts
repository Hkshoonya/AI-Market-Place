/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with configurable limits.
 *
 * Note: In a multi-instance deployment, use Redis-backed rate limiting instead.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given identifier (usually IP address).
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const { limit, windowMs } = config;
  const now = Date.now();

  cleanup(windowMs);

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  const remaining = Math.max(0, limit - entry.timestamps.length);
  const oldestInWindow = entry.timestamps[0] ?? now;
  const reset = Math.ceil((oldestInWindow + windowMs - now) / 1000);

  if (entry.timestamps.length >= limit) {
    return { success: false, limit, remaining: 0, reset };
  }

  entry.timestamps.push(now);
  return { success: true, limit, remaining: remaining - 1, reset };
}

/**
 * Pre-configured rate limit profiles.
 */
export const RATE_LIMITS = {
  /** Public endpoints: 60 req/min */
  public: { limit: 60, windowMs: 60_000 },
  /** Search endpoints: 30 req/min */
  search: { limit: 30, windowMs: 60_000 },
  /** Write endpoints (POST/PUT/DELETE): 20 req/min */
  write: { limit: 20, windowMs: 60_000 },
  /** Auth endpoints: 10 req/min */
  auth: { limit: 10, windowMs: 60_000 },
  /** API / programmatic endpoints (MCP, agent chat): 30 req/min */
  api: { limit: 30, windowMs: 60_000 },
} as const;

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  // Prefer x-real-ip (set by reverse proxy, harder to spoof)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Fallback to last entry in x-forwarded-for (closest proxy)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }
  return "unknown";
}

/**
 * Create a NextResponse with rate limit headers.
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}
