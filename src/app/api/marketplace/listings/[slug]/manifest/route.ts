/**
 * GET /api/marketplace/listings/:slug/manifest
 *
 * Returns the skill manifest for a listing (if it has one).
 *
 * Skill manifests describe the capabilities, input/output schemas,
 * runtime requirements, and pricing of a marketplace skill.
 *
 * The manifest is stored inside the listing's `agent_config.skill_manifest`
 * field. This endpoint extracts it and returns a standardised response,
 * enriched with listing-level metadata (price, currency, slug).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`manifest:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { slug } = await params;

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: listing, error } = await supabase
    .from("marketplace_listings")
    .select(
      "id, slug, title, listing_type, pricing_type, price, currency, agent_config, status"
    )
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !listing) {
    return NextResponse.json(
      { error: "Listing not found." },
      { status: 404 }
    );
  }

  // Extract skill_manifest from agent_config
  const agentConfig =
    listing.agent_config && typeof listing.agent_config === "object"
      ? listing.agent_config
      : null;

  const skillManifest =
    agentConfig &&
    typeof (agentConfig as Record<string, unknown>).skill_manifest === "object"
      ? (agentConfig as Record<string, unknown>).skill_manifest
      : null;

  if (!skillManifest) {
    return NextResponse.json(
      {
        error:
          "This listing does not have a skill manifest. Only listings created with a skill_manifest field expose this endpoint.",
      },
      { status: 404 }
    );
  }

  // Build the standardised manifest response, merging listing-level pricing
  const manifest = skillManifest as Record<string, unknown>;

  const response: Record<string, unknown> = {
    name: manifest.name ?? listing.title,
    version: manifest.version ?? "1.0.0",
    type: manifest.type ?? listing.listing_type,
    capabilities: Array.isArray(manifest.capabilities)
      ? manifest.capabilities
      : [],
    ...(manifest.input_schema
      ? { input_schema: manifest.input_schema }
      : {}),
    ...(manifest.output_schema
      ? { output_schema: manifest.output_schema }
      : {}),
    ...(manifest.runtime ? { runtime: manifest.runtime } : {}),
    ...(manifest.endpoint ? { endpoint: manifest.endpoint } : {}),
    pricing: manifest.pricing ?? {
      model: listing.pricing_type ?? "one_time",
      price: listing.price ?? 0,
      currency: listing.currency ?? "USD",
    },
    // Metadata
    listing_slug: listing.slug,
    listing_id: listing.id,
  };

  return NextResponse.json({ manifest: response });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/manifest");
  }
}
