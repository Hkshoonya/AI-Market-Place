import { z } from "zod";

import { parseQueryResultPartial } from "@/lib/schemas/parse";
import type {
  ListingPolicyReview,
  MarketplaceAutonomyMode,
  MarketplaceAutonomyRiskLevel,
  MarketplaceContentRiskLevel,
  MarketplaceListingWithSeller,
  MarketplacePurchaseMode,
  TypedSupabaseClient,
} from "@/types/database";

export interface ListingPolicySnapshot {
  purchase_mode?: MarketplacePurchaseMode | null;
  autonomy_mode?: MarketplaceAutonomyMode | null;
  content_risk_level?: MarketplaceContentRiskLevel | null;
  autonomy_risk_level?: ListingPolicyReview["autonomy_risk_level"] | null;
}

const ListingPolicyReviewSchema = z.object({
  listing_id: z.string(),
  purchase_mode: z.string().nullable().optional(),
  autonomy_mode: z.string().nullable().optional(),
  content_risk_level: z.string().nullable().optional(),
  autonomy_risk_level: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

type PolicyReviewRow = z.infer<typeof ListingPolicyReviewSchema>;

const PURCHASE_MODES = [
  "public_purchase_allowed",
  "manual_review_required",
  "purchase_blocked",
] as const satisfies readonly MarketplacePurchaseMode[];

const AUTONOMY_MODES = [
  "autonomous_allowed",
  "manual_only",
  "restricted",
  "autonomous_blocked",
] as const satisfies readonly MarketplaceAutonomyMode[];

const CONTENT_RISK_LEVELS = [
  "allow",
  "review",
  "block",
] as const satisfies readonly MarketplaceContentRiskLevel[];

const AUTONOMY_RISK_LEVELS = [
  "allow",
  "manual_only",
  "restricted",
  "block",
] as const satisfies readonly MarketplaceAutonomyRiskLevel[];

function isPurchaseMode(value: string): value is MarketplacePurchaseMode {
  return PURCHASE_MODES.includes(value as MarketplacePurchaseMode);
}

function isAutonomyMode(value: string): value is MarketplaceAutonomyMode {
  return AUTONOMY_MODES.includes(value as MarketplaceAutonomyMode);
}

function isContentRiskLevel(value: string): value is MarketplaceContentRiskLevel {
  return CONTENT_RISK_LEVELS.includes(value as MarketplaceContentRiskLevel);
}

function isAutonomyRiskLevel(value: string): value is MarketplaceAutonomyRiskLevel {
  return AUTONOMY_RISK_LEVELS.includes(value as MarketplaceAutonomyRiskLevel);
}

function getPolicyTimestamp(review: PolicyReviewRow): number {
  const value = review.updated_at ?? review.created_at;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function selectLatestListingPolicies(
  reviews: PolicyReviewRow[]
): Map<string, ListingPolicySnapshot> {
  const latestByListing = new Map<string, PolicyReviewRow>();

  for (const review of reviews) {
    const existing = latestByListing.get(review.listing_id);
    if (!existing || getPolicyTimestamp(review) >= getPolicyTimestamp(existing)) {
      latestByListing.set(review.listing_id, review);
    }
  }

  return new Map(
    [...latestByListing.entries()].map(([listingId, review]) => [
      listingId,
      {
        purchase_mode:
          typeof review.purchase_mode === "string" && isPurchaseMode(review.purchase_mode)
            ? review.purchase_mode
            : null,
        autonomy_mode:
          typeof review.autonomy_mode === "string" && isAutonomyMode(review.autonomy_mode)
            ? review.autonomy_mode
            : null,
        content_risk_level:
          typeof review.content_risk_level === "string" &&
          isContentRiskLevel(review.content_risk_level)
            ? review.content_risk_level
            : null,
        autonomy_risk_level:
          typeof review.autonomy_risk_level === "string" &&
          isAutonomyRiskLevel(review.autonomy_risk_level)
            ? review.autonomy_risk_level
            : null,
      },
    ])
  );
}

export async function attachListingPolicies<
  T extends {
    id: MarketplaceListingWithSeller["id"];
    purchase_mode?: MarketplacePurchaseMode | string | null;
    autonomy_mode?: MarketplaceAutonomyMode | string | null;
    content_risk_level?: MarketplaceContentRiskLevel | string | null;
    autonomy_risk_level?: ListingPolicyReview["autonomy_risk_level"] | string | null;
  },
>(
  supabase: TypedSupabaseClient,
  listings: T[]
): Promise<Array<T & ListingPolicySnapshot>> {
  if (!listings.length) return listings as Array<T & ListingPolicySnapshot>;

  const listingIds = [...new Set(listings.map((listing) => listing.id))];
  const response = await supabase
    .from("listing_policy_reviews")
    .select(
      "listing_id, purchase_mode, autonomy_mode, content_risk_level, autonomy_risk_level, created_at, updated_at"
    )
    .in("listing_id", listingIds);

  const reviews = parseQueryResultPartial(
    response,
    ListingPolicyReviewSchema,
    "MarketplaceListingPolicyReview"
  );

  if (!reviews.length) {
    return listings as Array<T & ListingPolicySnapshot>;
  }

  const policyByListingId = selectLatestListingPolicies(reviews);

  return listings.map((listing) => {
    const policy = policyByListingId.get(listing.id);
    if (!policy) return listing as T & ListingPolicySnapshot;

    return {
      ...listing,
      purchase_mode: policy.purchase_mode ?? listing.purchase_mode ?? undefined,
      autonomy_mode: policy.autonomy_mode ?? listing.autonomy_mode ?? undefined,
      content_risk_level:
        policy.content_risk_level ?? listing.content_risk_level ?? undefined,
      autonomy_risk_level:
        policy.autonomy_risk_level ?? listing.autonomy_risk_level ?? undefined,
    } as T & ListingPolicySnapshot;
  });
}
