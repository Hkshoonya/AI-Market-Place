import { z } from "zod";

import { parseQueryResultPartial } from "@/lib/schemas/parse";
import type { TypedSupabaseClient } from "@/types/database";

import { evaluateListingPolicy, syncListingPolicyReview } from "./policy";

const MarketplacePolicyRescanListingSchema = z.object({
  id: z.string(),
  seller_id: z.string(),
  title: z.string(),
  description: z.string(),
  short_description: z.string().nullable().optional(),
  listing_type: z.string(),
  tags: z.array(z.string()).optional().default([]),
  agent_config: z.record(z.string(), z.unknown()).nullable().optional(),
  mcp_manifest: z.record(z.string(), z.unknown()).nullable().optional(),
  preview_manifest: z.record(z.string(), z.unknown()).nullable().optional(),
});

const ExistingPolicyRowSchema = z.object({
  listing_id: z.string(),
});

export async function rescanMarketplaceListingPolicies(
  supabase: TypedSupabaseClient,
  options?: {
    limit?: number;
    onlyMissing?: boolean;
  }
) {
  const limit = Math.max(1, Math.min(options?.limit ?? 500, 2000));
  const onlyMissing = options?.onlyMissing ?? true;

  const listingsResponse = await supabase
    .from("marketplace_listings")
    .select(
      "id, seller_id, title, description, short_description, listing_type, tags, agent_config, mcp_manifest, preview_manifest"
    )
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);

  const listings = parseQueryResultPartial(
    listingsResponse,
    MarketplacePolicyRescanListingSchema,
    "MarketplacePolicyRescanListing"
  );

  let targetListings = listings;

  if (onlyMissing && listings.length > 0) {
    const policyResponse = await supabase
      .from("listing_policy_reviews")
      .select("listing_id")
      .in(
        "listing_id",
        listings.map((listing) => listing.id)
      );

    const existingPolicies = parseQueryResultPartial(
      policyResponse,
      ExistingPolicyRowSchema,
      "MarketplacePolicyRescanExistingPolicy"
    );
    const existingListingIds = new Set(
      existingPolicies.map((policy) => policy.listing_id)
    );
    targetListings = listings.filter(
      (listing) => !existingListingIds.has(listing.id)
    );
  }

  let allow = 0;
  let review = 0;
  let block = 0;

  for (const listing of targetListings) {
    const evaluation = evaluateListingPolicy({
      title: listing.title,
      description: listing.description,
      shortDescription: listing.short_description ?? null,
      listingType: listing.listing_type,
      tags: listing.tags,
      agentConfig: listing.agent_config ?? null,
      mcpManifest: listing.mcp_manifest ?? null,
      previewManifest: listing.preview_manifest ?? null,
    });

    await syncListingPolicyReview(supabase, {
      listingId: listing.id,
      sellerId: listing.seller_id,
      sourceAction: "manual_rescan",
      evaluation,
      excerpt: listing.short_description ?? listing.description.slice(0, 280),
    });

    if (evaluation.decision === "allow") allow += 1;
    if (evaluation.decision === "review") review += 1;
    if (evaluation.decision === "block") block += 1;
  }

  return {
    scanned: targetListings.length,
    totalCandidates: listings.length,
    onlyMissing,
    allow,
    review,
    block,
  };
}
