/**
 * Helper to enrich marketplace listings with seller profile data.
 *
 * The `marketplace_listings` table does NOT have a foreign key constraint from
 * `seller_id` to the `profiles` table — so Supabase's PostgREST embedded join
 * (`profiles!marketplace_listings_seller_id_fkey(...)`) fails at runtime.
 *
 * This module provides a two-query approach:
 *   1. Fetch listings (caller handles this)
 *   2. Separately fetch matching profiles by seller_id
 *   3. Merge profiles onto listings under the `profiles` key
 *
 * This keeps the shape identical to what components expect: `listing.profiles.*`
 */

import { z } from "zod";
import { parseQueryResult, parseQueryResultSingle } from "@/lib/schemas/parse";
import type { TypedSupabaseClient } from "@/types/database";

/** Minimal profile fields used by listing cards */
export const PROFILE_FIELDS_CARD =
  "id, display_name, avatar_url, username, seller_verified" as const;

/** Full profile fields used by listing detail / seller card */
export const PROFILE_FIELDS_FULL =
  "id, display_name, avatar_url, username, is_seller, seller_verified, seller_rating, total_sales, seller_bio, seller_website, created_at" as const;

/** Profile fields used by the admin listings table */
export const PROFILE_FIELDS_ADMIN =
  "id, display_name, username" as const;

/**
 * Enrich an array of listings with seller profiles.
 *
 * @param supabase  Any Supabase client (server or admin)
 * @param listings  Array of listing objects with `seller_id` field
 * @param fields    Profile select fields (defaults to card fields)
 * @returns         Same listings array with `profiles` property merged onto each
 */
export async function enrichListingsWithProfiles<
  T extends { seller_id?: string | null }
>(
  supabase: TypedSupabaseClient,
  listings: T[],
  fields: string = PROFILE_FIELDS_CARD
): Promise<(T & { profiles: Record<string, unknown> | null })[]> {
  if (!listings || listings.length === 0) {
    return [] as (T & { profiles: Record<string, unknown> | null })[];
  }

  // Collect unique seller IDs
  const sellerIds = [
    ...new Set(
      listings
        .map((l) => l.seller_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  if (sellerIds.length === 0) {
    return listings.map((l) => ({ ...l, profiles: null }));
  }

  // Use a permissive schema since `fields` is dynamic (card vs full vs admin)
  const DynamicProfileSchema = z.object({ id: z.string() }).passthrough();
  const profilesResponse = await supabase
    .from("profiles")
    .select(fields)
    .in("id", sellerIds);

  const profiles = parseQueryResult(profilesResponse, DynamicProfileSchema, "EnrichListingsProfiles");
  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of profiles) {
    profileMap.set(p.id, p);
  }

  return listings.map((l) => ({
    ...l,
    profiles: l.seller_id ? profileMap.get(l.seller_id) ?? null : null,
  }));
}

/**
 * Enrich a single listing with its seller profile.
 */
export async function enrichListingWithProfile<
  T extends { seller_id?: string | null }
>(
  supabase: TypedSupabaseClient,
  listing: T,
  fields: string = PROFILE_FIELDS_FULL
): Promise<T & { profiles: Record<string, unknown> | null }> {
  if (!listing.seller_id) {
    return { ...listing, profiles: null };
  }

  const DynamicProfileSchema = z.object({ id: z.string() }).passthrough();
  const profileResponse = await supabase
    .from("profiles")
    .select(fields)
    .eq("id", listing.seller_id)
    .single();

  const profile = parseQueryResultSingle(profileResponse, DynamicProfileSchema, "EnrichListingProfile");
  return { ...listing, profiles: profile ?? null };
}
