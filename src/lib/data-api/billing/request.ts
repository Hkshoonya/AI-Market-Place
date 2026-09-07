import "server-only";
import { ApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedRequestOrigin } from "@/lib/security/request-origin";
import { getClientIp, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export async function requireBillingUser(request: NextRequest, { mutation = true, managementOnly = false } = {}) {
  if (mutation && !hasTrustedRequestOrigin(request)) throw new ApiError(403, "Untrusted request origin");
  const limit = await rateLimit(`data-billing:${getClientIp(request)}`, RATE_LIMITS.auth);
  if (!limit.success) throw new ApiError(429, "Too many billing requests. Please retry shortly.");
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new ApiError(401, "Sign in to manage data billing");
  const { data: profile, error: profileError } = await client.from("profiles").select("is_banned").eq("id", user.id).single();
  const canPurchase = Boolean(user.email_confirmed_at) && !profileError && profile?.is_banned === false;
  // An authenticated owner must retain cancellation access after a ban or
  // email change. Portal ownership is independently checked against Stripe.
  if (!managementOnly && !canPurchase) throw new ApiError(403, "Verify your email and account eligibility before purchasing");
  const userLimit = await rateLimit(`data-billing:user:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (!userLimit.success) throw new ApiError(429, "Too many billing requests. Please retry shortly.");
  return { user, canPurchase };
}

export async function readBillingBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing request body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { void reader.cancel().catch(() => {}); throw new ApiError(413, "Request is too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks, size).toString("utf8")) as unknown; }
  catch { throw new ApiError(400, "Invalid JSON request"); }
}
