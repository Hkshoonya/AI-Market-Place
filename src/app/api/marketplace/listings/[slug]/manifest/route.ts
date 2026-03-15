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
import { buildListingPreviewManifest } from "@/lib/marketplace/manifest";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`manifest:${ip}`, RATE_LIMITS.public);
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
      "id, slug, title, description, short_description, listing_type, pricing_type, price, currency, tags, documentation_url, demo_url, agent_config, mcp_manifest, preview_manifest, status"
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

  const manifest = buildListingPreviewManifest({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description ?? listing.title,
    short_description: listing.short_description ?? null,
    listing_type: listing.listing_type,
    pricing_type: listing.pricing_type ?? "one_time",
    price: listing.price ?? 0,
    currency: listing.currency ?? "USD",
    tags: Array.isArray(listing.tags) ? listing.tags : [],
    documentation_url: listing.documentation_url ?? null,
    demo_url: listing.demo_url ?? null,
    agent_config:
      listing.agent_config && typeof listing.agent_config === "object"
        ? (listing.agent_config as Record<string, unknown>)
        : null,
    mcp_manifest:
      listing.mcp_manifest && typeof listing.mcp_manifest === "object"
        ? (listing.mcp_manifest as Record<string, unknown>)
        : null,
    preview_manifest:
      listing.preview_manifest && typeof listing.preview_manifest === "object"
        ? (listing.preview_manifest as Record<string, unknown>)
        : null,
  });

  return NextResponse.json({ manifest });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/manifest");
  }
}
