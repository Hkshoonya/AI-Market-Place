/**
 * Durable rate limiting for API routes.
 *
 * Uses Supabase/Postgres when a service-role key is available and falls back to
 * an in-memory window inside the current process if the durable backend is not
 * configured or temporarily unavailable.
 */

import { isIP } from "node:net";
import { createAdminClient } from "@/lib/supabase/admin";

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitRpcRow {
  allowed: boolean;
  limit_count: number;
  remaining: number;
  reset: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

const PROVIDER_IP_HEADERS = [
  "cf-connecting-ip",
  "fly-client-ip",
  "x-vercel-forwarded-for",
  "x-real-ip",
] as const;

const PROXY_HINT_HEADERS = [
  "cf-ray",
  "x-vercel-id",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "via",
  "forwarded",
] as const;

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

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

function getInMemoryRateLimit(
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

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  const remaining = Math.max(0, limit - entry.timestamps.length);
  const oldestInWindow = entry.timestamps[0] ?? now;
  const reset = Math.max(
    1,
    Math.ceil((oldestInWindow + windowMs - now) / 1000)
  );

  if (entry.timestamps.length >= limit) {
    return { success: false, limit, remaining: 0, reset };
  }

  entry.timestamps.push(now);
  return { success: true, limit, remaining: remaining - 1, reset };
}

function getRateLimitBackend(): "database" | "memory" {
  const configured = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase();
  const hasDurableConfig =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (configured === "memory") {
    return "memory";
  }

  if (configured === "database") {
    return hasDurableConfig ? "database" : "memory";
  }

  return hasDurableConfig ? "database" : "memory";
}

async function getDurableRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  if (getRateLimitBackend() !== "database") {
    return null;
  }

  try {
    const supabase = createAdminClient();
    const windowSeconds = Math.max(1, Math.ceil(config.windowMs / 1000));
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket_key: identifier,
      p_max_requests: config.limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("[rate-limit] durable backend failed", {
        identifier,
        message: error.message,
      });
      return null;
    }

    const row = Array.isArray(data)
      ? (data[0] as RateLimitRpcRow | undefined)
      : (data as RateLimitRpcRow | null);

    if (!row) {
      console.error("[rate-limit] durable backend returned no data", {
        identifier,
      });
      return null;
    }

    return {
      success: row.allowed,
      limit: row.limit_count,
      remaining: row.remaining,
      reset: row.reset,
    };
  } catch (error) {
    console.error("[rate-limit] durable backend threw", {
      identifier,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function normalizeIpCandidate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let candidate = value.trim();
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  return isIP(candidate) ? candidate : null;
}

function hasTrustedProxySignal(request: Request): boolean {
  return PROXY_HINT_HEADERS.some((header) => !!request.headers.get(header));
}

function getForwardedIp(request: Request): string | null {
  if (!hasTrustedProxySignal(request)) {
    return null;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) {
    return null;
  }

  for (const part of forwarded.split(",")) {
    const candidate = normalizeIpCandidate(part);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

/**
 * Check rate limit for a given identifier (usually IP address or account id).
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const durableResult = await getDurableRateLimit(identifier, config);
  if (durableResult) {
    return durableResult;
  }

  return getInMemoryRateLimit(identifier, config);
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
 * Get client IP from trusted proxy headers.
 */
export function getClientIp(request: Request): string {
  for (const header of PROVIDER_IP_HEADERS) {
    const rawValue = request.headers.get(header);
    if (!rawValue) {
      continue;
    }

    for (const part of rawValue.split(",")) {
      const candidate = normalizeIpCandidate(part);
      if (candidate) {
        return candidate;
      }
    }
  }

  const forwarded = getForwardedIp(request);
  if (forwarded) {
    return forwarded;
  }

  return "unknown";
}

/**
 * Create response headers that expose the applied limit window.
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

export function resetRateLimitStore() {
  store.clear();
  lastCleanup = Date.now();
}
