import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/agents/auth";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { hasTrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

// GET: List user's API keys
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`api-keys:${ip}`, RATE_LIMITS.auth);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to manage API keys." },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("api_keys")
      .select(
        "id, name, key_prefix, scopes, rate_limit_per_minute, last_used_at, expires_at, is_active, created_at"
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch API keys. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({ keys: data ?? [] });
  } catch (err) {
    return handleApiError(err, "api/api-keys");
  }
}

// POST: Create new API key
export async function POST(request: NextRequest) {
  if (!hasTrustedRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(`api-keys:${ip}`, RATE_LIMITS.auth);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to create an API key." },
        { status: 401 }
      );
    }

    const apiKeySchema = z.object({
      name: z.string().min(2, "Name must be at least 2 characters").max(100),
      scopes: z.array(z.enum(["read", "write", "agent", "mcp", "marketplace", "withdraw"])).optional(),
      rate_limit: z.number().int().min(1).max(1000).optional(),
      expires_in_days: z.number().int().min(1).max(365).optional(),
    });

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body. Please send a valid JSON object." },
        { status: 400 }
      );
    }

    const parsed = apiKeySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Check max keys per user (limit: 10)
    const { count } = await supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("is_active", true);

    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: "Maximum 10 active API keys allowed" },
        { status: 400 }
      );
    }

    const { plaintext, hash, prefix } = generateApiKey();

    const validScopes = ["read", "write", "agent", "mcp", "marketplace", "withdraw"];
    const scopes = (body.scopes ?? ["read"]).filter((s) =>
      validScopes.includes(s)
    );

    const expiresAt = body.expires_in_days
      ? new Date(
          Date.now() + body.expires_in_days * 24 * 60 * 60 * 1000
        ).toISOString()
      : null;

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        owner_id: user.id,
        name: body.name,
        key_prefix: prefix,
        key_hash: hash,
        scopes,
        rate_limit_per_minute: body.rate_limit ?? 60,
        expires_at: expiresAt,
        is_active: true,
      })
      .select(
        "id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create API key. Please try again later." },
        { status: 500 }
      );
    }

    // Return plaintext key ONCE
    return NextResponse.json(
      {
        key: data,
        plaintext_key: plaintext,
        warning: "Store this key securely. It will not be shown again.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "api/api-keys");
  }
}
