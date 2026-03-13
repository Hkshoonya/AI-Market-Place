/**
 * API Paywall Middleware
 *
 * Request classification:
 *   Supabase JWT cookie  ->  HUMAN  ->  Free access (rate limited)
 *   aimk_ API key        ->  BOT    ->  Check pricing, charge wallet
 *   No auth              ->  PUBLIC ->  Rate-limited free access
 *
 * This is called from Next.js API routes that want paywall protection.
 * It's NOT a Next.js middleware (middleware.ts) -- it's a utility function
 * called inside individual API route handlers.
 */

import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { debitWallet, getWalletByOwner } from "@/lib/payments/wallet";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { Database } from "@/types/database";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CallerType = "human" | "bot" | "public";

export interface PaywallResult {
  allowed: boolean;
  callerType: CallerType;
  /** For humans -- Supabase user id (when we can extract it from the cookie) */
  userId?: string;
  /** For bots -- the `api_keys.id` row that matched */
  apiKeyId?: string;
  /** Owner of the API key (for bots) */
  ownerId?: string;
  /** Amount charged in USD (for bots on paid endpoints) */
  charged?: number;
  /** Human-readable error message when `allowed` is false */
  error?: string;
  /** HTTP status code to return when `allowed` is false */
  statusCode?: number;
}

// ---------------------------------------------------------------------------
// Pricing rule cache
// ---------------------------------------------------------------------------

interface PricingRule {
  id: number;
  path_pattern: string;
  method: string;
  price_per_call: number;
  is_free_for_humans: boolean;
  rate_limit_free: number;
  rate_limit_paid: number;
}

let pricingRulesCache: PricingRule[] = [];
let pricingCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadPricingRules(): Promise<PricingRule[]> {
  if (
    Date.now() - pricingCacheTime < CACHE_TTL &&
    pricingRulesCache.length > 0
  ) {
    return pricingRulesCache;
  }

  const sb = createAdminClient();

  const { data } = await sb
    .from("api_endpoint_pricing")
    .select("id, path_pattern, method, price_per_call, is_free_for_humans, rate_limit_free, rate_limit_paid")
    .eq("is_active", true);

  if (data) {
    pricingRulesCache = data as PricingRule[];
    pricingCacheTime = Date.now();
  }

  return pricingRulesCache;
}

/**
 * Find the first pricing rule whose `path_pattern` regex matches the given
 * request path and method.
 */
function matchPricingRule(
  path: string,
  method: string
): PricingRule | null {
  for (const rule of pricingRulesCache) {
    if (rule.method !== method && rule.method !== "*") continue;
    try {
      if (new RegExp(rule.path_pattern).test(path)) return rule;
    } catch {
      // invalid regex in the DB row -- skip silently
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Check if a request should be allowed and potentially charged.
 * Call this at the top of API route handlers that want paywall protection.
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const pw = await checkPaywall(request);
 *   if (!pw.allowed) return paywallErrorResponse(pw);
 *   // ... handle the request
 * }
 * ```
 */
export async function checkPaywall(
  request: NextRequest
): Promise<PaywallResult> {
  await loadPricingRules();

  const path = new URL(request.url).pathname;
  const method = request.method;
  const rule = matchPricingRule(path, method);

  // ---- Step 1: Identify caller type ----

  const authHeader = request.headers.get("authorization") || "";

  // Check for API key (bot)
  if (authHeader.startsWith("Bearer aimk_")) {
    const apiKey = authHeader.slice(7); // strip "Bearer "
    return handleBotRequest(request, apiKey, rule);
  }

  // Check for a valid Supabase session (human)
  const resolvedUser = await resolvePaywallUser(request);
  if (resolvedUser) {
    return handleHumanRequest(request, rule, resolvedUser.id);
  }

  // Public / unauthenticated
  return handlePublicRequest(request, rule);
}

// ---------------------------------------------------------------------------
// Bot requests (API key authentication)
// ---------------------------------------------------------------------------

async function handleBotRequest(
  request: NextRequest,
  apiKey: string,
  rule: PricingRule | null
): Promise<PaywallResult> {
  const sb = createAdminClient();

  // Validate API key by hashing and looking it up
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const { data: keyRecord } = await sb
    .from("api_keys")
    .select("id, owner_id, is_active, rate_limit_per_minute, expires_at, scopes")
    .eq("key_hash", keyHash)
    .single();

  if (!keyRecord || !keyRecord.is_active) {
    return {
      allowed: false,
      callerType: "bot",
      error: "Invalid or inactive API key",
      statusCode: 401,
    };
  }

  if (
    keyRecord.expires_at &&
    new Date(keyRecord.expires_at) < new Date()
  ) {
    return {
      allowed: false,
      callerType: "bot",
      error: "API key expired",
      statusCode: 401,
    };
  }

  // Rate limit bots by key id + IP
  const ip = getClientIp(request);
  const rateLimitValue =
    rule?.rate_limit_paid || keyRecord.rate_limit_per_minute || 300;

  const rl = await rateLimit(`bot:${keyRecord.id}:${ip}`, {
    limit: rateLimitValue,
    windowMs: 60_000,
  });

  if (!rl.success) {
    return {
      allowed: false,
      callerType: "bot",
      error: "Rate limit exceeded",
      statusCode: 429,
      apiKeyId: keyRecord.id,
      ownerId: keyRecord.owner_id,
    };
  }

  // Fire-and-forget: update last_used_at timestamp
  sb.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then(() => {
      /* intentionally ignored */
    });

  // Check if this endpoint has a price
  const price = rule?.price_per_call || 0;

  if (price > 0) {
    // Charge the bot's wallet
    const wallet = await getWalletByOwner(keyRecord.owner_id);

    if (!wallet) {
      return {
        allowed: false,
        callerType: "bot",
        error: "No wallet found. Create a wallet and deposit funds first.",
        statusCode: 402,
        apiKeyId: keyRecord.id,
        ownerId: keyRecord.owner_id,
      };
    }

    if (Number(wallet.balance) < price) {
      return {
        allowed: false,
        callerType: "bot",
        error: `Insufficient balance. Required: $${price}, Available: $${wallet.balance}`,
        statusCode: 402,
        apiKeyId: keyRecord.id,
        ownerId: keyRecord.owner_id,
      };
    }

    try {
      await debitWallet(wallet.id, price, "api_charge", {
        referenceType: "api_call",
        description: `API call: ${request.method} ${new URL(request.url).pathname}`,
      });
    } catch {
      return {
        allowed: false,
        callerType: "bot",
        error: "Failed to charge wallet",
        statusCode: 402,
        apiKeyId: keyRecord.id,
        ownerId: keyRecord.owner_id,
      };
    }

    return {
      allowed: true,
      callerType: "bot",
      apiKeyId: keyRecord.id,
      ownerId: keyRecord.owner_id,
      charged: price,
    };
  }

  // Free endpoint for bots
  return {
    allowed: true,
    callerType: "bot",
    apiKeyId: keyRecord.id,
    ownerId: keyRecord.owner_id,
  };
}

// ---------------------------------------------------------------------------
// Human requests (Supabase session cookie)
// ---------------------------------------------------------------------------

async function handleHumanRequest(
  request: NextRequest,
  rule: PricingRule | null,
  userId?: string
): Promise<PaywallResult> {
  // Humans always get free access, just rate-limited
  const ip = getClientIp(request);
  const limit = rule?.rate_limit_free || 60;

  const rl = await rateLimit(`human:${ip}`, { limit, windowMs: 60_000 });

  if (!rl.success) {
    return {
      allowed: false,
      callerType: "human",
      error: "Rate limit exceeded",
      statusCode: 429,
    };
  }

  return { allowed: true, callerType: "human", userId };
}

// ---------------------------------------------------------------------------
// Public / unauthenticated requests
// ---------------------------------------------------------------------------

async function handlePublicRequest(
  request: NextRequest,
  rule: PricingRule | null
): Promise<PaywallResult> {
  const ip = getClientIp(request);
  const limit = rule?.rate_limit_free || 10;

  const rl = await rateLimit(`public:${ip}`, { limit, windowMs: 60_000 });

  if (!rl.success) {
    return {
      allowed: false,
      callerType: "public",
      error: "Rate limit exceeded",
      statusCode: 429,
    };
  }

  return { allowed: true, callerType: "public" };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Turn a failed `PaywallResult` into a proper NextResponse.
 *
 * For 402 (Payment Required) errors the body includes deposit instructions
 * so bot developers know how to fund their wallets.
 */
export function paywallErrorResponse(result: PaywallResult): NextResponse {
  const body: Record<string, unknown> = { error: result.error };

  if (result.statusCode === 402) {
    body.deposit_info = {
      message: "Deposit USDC to your wallet to continue",
      supported_chains: ["solana", "base", "polygon"],
    };
  }

  return NextResponse.json(body, { status: result.statusCode || 403 });
}

async function resolvePaywallUser(
  request: NextRequest
): Promise<{ id: string } | null> {
  const hasSbCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  if (!hasSbCookie) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Paywall checks are read-only; session refresh writes are unnecessary here.
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user ? { id: user.id } : null;
  } catch {
    return null;
  }
}
