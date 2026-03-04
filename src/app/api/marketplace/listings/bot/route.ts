/**
 * Bot-as-Seller Marketplace API
 *
 * POST  /api/marketplace/listings/bot -- Create listing (bot auth via aimk_ key)
 * PATCH /api/marketplace/listings/bot -- Update listing (by slug, bot auth)
 *
 * Bots need a "marketplace" scope on their API key.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateWallet } from "@/lib/payments/wallet";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const LISTING_TYPES = [
  "api_access",
  "model_weights",
  "fine_tuned_model",
  "dataset",
  "prompt_template",
  "agent",
  "mcp_server",
] as const;

const skillManifestSchema = z
  .object({
    name: z.string().min(1).max(200),
    version: z.string().max(50).optional(),
    type: z.string().max(100).optional(),
    capabilities: z.array(z.string().max(100)).max(50).optional(),
    input_schema: z.record(z.string(), z.unknown()).optional(),
    output_schema: z.record(z.string(), z.unknown()).optional(),
    runtime: z.string().max(100).optional(),
    endpoint: z.string().url().optional(),
    pricing: z
      .object({
        model: z.string().max(50).optional(),
        price: z.number().min(0).optional(),
        currency: z.string().max(10).optional(),
      })
      .optional(),
  })
  .passthrough();

const createBotListingSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(10000, "Description must be 10000 characters or less"),
  short_description: z
    .string()
    .max(500, "Short description must be 500 characters or less")
    .optional()
    .nullable(),
  listing_type: z.enum(LISTING_TYPES, {
    message: `listing_type must be one of: ${LISTING_TYPES.join(", ")}`,
  }),
  pricing_type: z
    .enum([
      "free",
      "one_time",
      "monthly_subscription",
      "per_token",
      "per_request",
      "contact",
    ])
    .optional()
    .default("one_time"),
  price: z
    .number()
    .min(0, "Price must be non-negative")
    .optional()
    .nullable(),
  currency: z.string().max(10).optional().default("USD"),
  model_id: z
    .string()
    .uuid("model_id must be a valid UUID")
    .optional()
    .nullable(),
  tags: z
    .array(z.string().max(50))
    .max(20, "Maximum 20 tags allowed")
    .optional()
    .default([]),
  thumbnail_url: z
    .string()
    .url("thumbnail_url must be a valid URL")
    .optional()
    .nullable(),
  demo_url: z
    .string()
    .url("demo_url must be a valid URL")
    .optional()
    .nullable(),
  documentation_url: z
    .string()
    .url("documentation_url must be a valid URL")
    .optional()
    .nullable(),
  agent_config: z.record(z.string(), z.unknown()).optional().nullable(),
  mcp_manifest: z.record(z.string(), z.unknown()).optional().nullable(),
  skill_manifest: skillManifestSchema.optional().nullable(),
});

const updateBotListingSchema = z.object({
  slug: z.string().min(1, "slug is required"),
  title: z.string().min(1).max(200).optional(),
  short_description: z.string().max(500).optional().nullable(),
  listing_type: z.enum(LISTING_TYPES).optional(),
  pricing_type: z
    .enum([
      "free",
      "one_time",
      "monthly_subscription",
      "per_token",
      "per_request",
      "contact",
    ])
    .optional(),
  price: z
    .number()
    .min(0, "Price must be non-negative")
    .optional()
    .nullable(),
  currency: z.string().max(10).optional(),
  status: z.enum(["active", "paused", "draft"]).optional(),
  description: z
    .string()
    .max(10000, "Description must be 10000 characters or less")
    .optional(),
  tags: z
    .array(z.string().max(50))
    .max(20, "Maximum 20 tags allowed")
    .optional(),
  thumbnail_url: z.string().url().optional().nullable(),
  demo_url: z.string().url().optional().nullable(),
  documentation_url: z.string().url().optional().nullable(),
  agent_config: z.record(z.string(), z.unknown()).optional().nullable(),
  mcp_manifest: z.record(z.string(), z.unknown()).optional().nullable(),
  model_id: z.string().uuid().optional().nullable(),
  skill_manifest: skillManifestSchema.optional().nullable(),
});

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

interface BotAuth {
  ownerId: string;
  apiKeyId: string;
  agentId: string | null;
}

/**
 * Authenticate a bot via `aimk_` bearer token and verify the
 * "marketplace" scope.
 */
async function authenticateBot(
  request: NextRequest
): Promise<BotAuth | NextResponse> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer aimk_")) {
    return NextResponse.json(
      {
        error:
          "Bot authentication required. Provide a valid aimk_ API key in the Authorization header.",
      },
      { status: 401 }
    );
  }

  const keyRaw = authHeader.slice(7); // Remove "Bearer "
  const keyHash = crypto
    .createHash("sha256")
    .update(keyRaw)
    .digest("hex");

  const sb = createAdminClient();

  const { data: apiKey, error } = await sb
    .from("api_keys")
    .select("id, owner_id, agent_id, scopes, is_active")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !apiKey) {
    return NextResponse.json(
      { error: "Invalid or inactive API key." },
      { status: 401 }
    );
  }

  // Verify the key has the "marketplace" scope
  const rawScopes: unknown = apiKey.scopes;
  const scopes: string[] = Array.isArray(rawScopes)
    ? rawScopes as string[]
    : typeof rawScopes === "string"
      ? (rawScopes as string).split(",").map((s: string) => s.trim())
      : [];

  if (!scopes.includes("marketplace")) {
    return NextResponse.json(
      {
        error:
          'This API key does not have the "marketplace" scope. Update the key scopes and try again.',
      },
      { status: 403 }
    );
  }

  return {
    ownerId: apiKey.owner_id,
    apiKeyId: apiKey.id,
    agentId: apiKey.agent_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// POST -- Create a listing as a bot
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`bot-listing-create:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Authenticate bot
  const auth = await authenticateBot(request);
  if (auth instanceof NextResponse) return auth;

  const { ownerId } = auth;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = createBotListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const sb = createAdminClient();

  // Ensure the bot's owner has is_seller: true
  const { data: profile } = await sb
    .from("profiles")
    .select("id, is_seller")
    .eq("id", ownerId)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: "Owner profile not found." },
      { status: 404 }
    );
  }

  if (!profile.is_seller) {
    await sb
      .from("profiles")
      .update({ is_seller: true })
      .eq("id", ownerId);
  }

  // Auto-create wallet for the bot's owner if not exists
  try {
    await getOrCreateWallet(ownerId);
  } catch {
    // Non-fatal: wallet creation is best-effort at listing time
  }

  const {
    title,
    description,
    short_description,
    listing_type,
    pricing_type,
    price,
    currency,
    model_id,
    tags,
    thumbnail_url,
    demo_url,
    documentation_url,
    agent_config,
    mcp_manifest,
    skill_manifest,
  } = parsed.data;

  // Generate slug
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  // Merge skill_manifest into agent_config if provided
  const mergedAgentConfig =
    skill_manifest || agent_config
      ? {
          ...(agent_config || {}),
          ...(skill_manifest
            ? { skill_manifest: skill_manifest }
            : {}),
        }
      : null;

  const { data, error } = await sb
    .from("marketplace_listings")
    .insert({
      seller_id: ownerId,
      slug,
      title,
      description,
      short_description: short_description || null,
      listing_type,
      status: "active",
      pricing_type: pricing_type || "one_time",
      price: price ?? null,
      currency: currency || "USD",
      model_id: model_id || null,
      tags: tags || [],
      thumbnail_url: thumbnail_url || null,
      demo_url: demo_url || null,
      documentation_url: documentation_url || null,
      ...(listing_type === "agent" || listing_type === "mcp_server" || mergedAgentConfig
        ? { agent_config: mergedAgentConfig }
        : {}),
      ...(listing_type === "mcp_server" && mcp_manifest
        ? { mcp_manifest }
        : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create listing. Please check your input and try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/bot");
  }
}

// ---------------------------------------------------------------------------
// PATCH -- Update a listing as a bot
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`bot-listing-update:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Authenticate bot
  const auth = await authenticateBot(request);
  if (auth instanceof NextResponse) return auth;

  const { ownerId } = auth;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = updateBotListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { slug, skill_manifest, agent_config, ...fields } = parsed.data;

  const sb = createAdminClient();

  // If skill_manifest is being updated, we need to merge it into agent_config
  const updates: Record<string, unknown> = {};

  // Copy simple fields
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates[key] = value;
    }
  }

  // Handle agent_config and skill_manifest updates
  if (skill_manifest !== undefined) {
    // skill_manifest is merged into agent_config
    // Fetch current agent_config to merge
    const { data: currentListing } = await sb
      .from("marketplace_listings")
      .select("agent_config")
      .eq("slug", slug)
      .eq("seller_id", ownerId)
      .single();

    const existingConfig =
      currentListing?.agent_config &&
      typeof currentListing.agent_config === "object"
        ? currentListing.agent_config
        : {};

    updates.agent_config = {
      ...(agent_config !== undefined ? (agent_config ?? {}) : existingConfig),
      skill_manifest: skill_manifest,
    };
  } else if (agent_config !== undefined) {
    // Direct agent_config update (no skill_manifest merge needed)
    updates.agent_config = agent_config;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 }
    );
  }

  // Always set updated_at
  updates.updated_at = new Date().toISOString();

  // Verify listing belongs to the bot's owner, then update
  const { data, error } = await sb
    .from("marketplace_listings")
    .update(updates)
    .eq("slug", slug)
    .eq("seller_id", ownerId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update listing. Please try again later." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error:
          "Listing not found, or it does not belong to this API key's owner.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/bot");
  }
}
