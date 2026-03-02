/**
 * Shared authentication resolver for API routes.
 *
 * Supports two auth methods:
 * 1. Supabase session (browser cookies)
 * 2. API key (Authorization: Bearer aimk_...)
 *
 * Use this in any route that should be accessible to both
 * human users and bots/agents.
 */

import { NextRequest } from "next/server";
import { extractApiKey, validateApiKey, hasScope } from "@/lib/agents/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResolvedUser {
  userId: string;
  authMethod: "session" | "api_key";
}

/**
 * Resolve the authenticated user from either a Supabase session or an API key.
 *
 * @param request - The incoming request
 * @param requiredScopes - If provided, the API key must have at least one of these scopes.
 *                         Session-based users bypass scope checks.
 * @returns The resolved user or null if unauthenticated / insufficient scope.
 */
export async function resolveAuthUser(
  request: NextRequest,
  requiredScopes?: string[]
): Promise<ResolvedUser | null> {
  // 1. Try Supabase session first
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return { userId: user.id, authMethod: "session" };
    }
  } catch {
    // Session auth failed — continue to API key
  }

  // 2. Try API key auth (aimk_ prefix)
  const apiKey = extractApiKey(request);
  if (!apiKey) return null;

  const admin = createAdminClient();
  const auth = await validateApiKey(admin, apiKey);

  if (!auth.valid || !auth.keyRecord) return null;

  // Check scopes if required
  if (requiredScopes && requiredScopes.length > 0) {
    const hasRequired = requiredScopes.some((scope) =>
      hasScope(auth.keyRecord!, scope)
    );
    if (!hasRequired) return null;
  }

  return {
    userId: auth.keyRecord.owner_id as string,
    authMethod: "api_key",
  };
}
