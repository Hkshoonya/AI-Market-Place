/**
 * API Key Authentication
 *
 * Generates, hashes, and validates API keys for bot/agent access.
 * Keys are stored as SHA-256 hashes in the database.
 * The plaintext key is only shown once at creation time.
 */

import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "aimk_";

/** Generate a new API key. Returns the plaintext key (show once) and its hash. */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString("hex");
  const plaintext = `${KEY_PREFIX}${random}`;
  const hash = hashApiKey(plaintext);
  const prefix = plaintext.substring(0, 12); // "aimk_" + first 7 chars
  return { plaintext, hash, prefix };
}

/** Hash an API key using SHA-256 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Validate an API key and return the key record if valid */
export async function validateApiKey(
  supabase: unknown,
  key: string
): Promise<{
  valid: boolean;
  keyRecord: Record<string, unknown> | null;
  error?: string;
}> {
  if (!key.startsWith(KEY_PREFIX)) {
    return { valid: false, keyRecord: null, error: "Invalid key format" };
  }

  const hash = hashApiKey(key);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Two-query approach: api_keys may not have FK to profiles
  const { data: rawData, error } = await sb
    .from("api_keys")
    .select("*")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .single();

  if (error || !rawData) {
    return { valid: false, keyRecord: null, error: "Invalid or inactive API key" };
  }

  // Enrich with owner profile
  let data = rawData;
  if (rawData.owner_id) {
    const { data: profile } = await sb
      .from("profiles")
      .select("id, username, display_name, is_admin")
      .eq("id", rawData.owner_id)
      .single();
    data = { ...rawData, profiles: profile ?? null };
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, keyRecord: null, error: "API key expired" };
  }

  // Update last_used_at (fire and forget)
  sb.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { valid: true, keyRecord: data };
}

/** Check if a key has a required scope */
export function hasScope(
  keyRecord: Record<string, unknown>,
  requiredScope: string
): boolean {
  const scopes = (keyRecord.scopes as string[]) ?? [];
  return scopes.includes(requiredScope);
}

/**
 * Extract API key from request Authorization header.
 * Supports: "Bearer aimk_..." format
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith(KEY_PREFIX)) {
      return token;
    }
  }

  return null;
}

/**
 * Middleware-style API key auth for route handlers.
 * Returns the validated key record or a 401 Response.
 */
export async function authenticateApiKey(
  supabase: unknown,
  request: Request,
  requiredScope?: string
): Promise<
  | { authenticated: true; keyRecord: Record<string, unknown> }
  | { authenticated: false; response: Response }
> {
  const key = extractApiKey(request);

  if (!key) {
    return {
      authenticated: false,
      response: Response.json(
        { error: "Missing API key. Use Authorization: Bearer aimk_..." },
        { status: 401 }
      ),
    };
  }

  const { valid, keyRecord, error } = await validateApiKey(supabase, key);

  if (!valid || !keyRecord) {
    return {
      authenticated: false,
      response: Response.json(
        { error: error ?? "Invalid API key" },
        { status: 401 }
      ),
    };
  }

  if (requiredScope && !hasScope(keyRecord, requiredScope)) {
    return {
      authenticated: false,
      response: Response.json(
        { error: `API key missing required scope: ${requiredScope}` },
        { status: 403 }
      ),
    };
  }

  return { authenticated: true, keyRecord };
}
