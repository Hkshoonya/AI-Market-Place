import { describe, expect, it, vi, beforeEach } from "vitest";

import { rescanMarketplaceListingPolicies } from "./policy-rescan";

const mockEvaluateListingPolicy = vi.fn();
const mockSyncListingPolicyReview = vi.fn();

vi.mock("./policy", () => ({
  evaluateListingPolicy: (...args: unknown[]) => mockEvaluateListingPolicy(...args),
  syncListingPolicyReview: (...args: unknown[]) => mockSyncListingPolicyReview(...args),
}));

function createSupabaseStub(options?: {
  listings?: Array<Record<string, unknown>>;
  existingPolicies?: Array<Record<string, unknown>>;
}) {
  return {
    from(table: string) {
      if (table === "marketplace_listings") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: options?.listings ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "listing_policy_reviews") {
        return {
          select: () => ({
            in: async () => ({
              data: options?.existingPolicies ?? [],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("rescanMarketplaceListingPolicies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluateListingPolicy.mockReturnValue({
      decision: "allow",
      label: "allow",
      confidence: 0.1,
      reasons: [],
      matchedSignals: [],
      contentRiskLevel: "allow",
      autonomyRiskLevel: "allow",
      purchaseMode: "public_purchase_allowed",
      autonomyMode: "autonomous_allowed",
      reasonCodes: [],
    });
    mockSyncListingPolicyReview.mockResolvedValue(undefined);
  });

  it("rescans only listings missing stored policy rows by default", async () => {
    const result = await rescanMarketplaceListingPolicies(
      createSupabaseStub({
        listings: [
          {
            id: "listing-1",
            seller_id: "seller-1",
            title: "Listing 1",
            description: "desc",
            short_description: "short",
            listing_type: "agent",
            tags: [],
            agent_config: null,
            mcp_manifest: null,
            preview_manifest: null,
          },
          {
            id: "listing-2",
            seller_id: "seller-2",
            title: "Listing 2",
            description: "desc",
            short_description: "short",
            listing_type: "api_access",
            tags: [],
            agent_config: null,
            mcp_manifest: null,
            preview_manifest: null,
          },
        ],
        existingPolicies: [{ listing_id: "listing-1" }],
      }) as never
    );

    expect(result).toMatchObject({
      scanned: 1,
      totalCandidates: 2,
      allow: 1,
      review: 0,
      block: 0,
      onlyMissing: true,
    });
    expect(mockSyncListingPolicyReview).toHaveBeenCalledTimes(1);
    expect(mockSyncListingPolicyReview.mock.calls[0]?.[1]).toMatchObject({
      listingId: "listing-2",
      sourceAction: "manual_rescan",
    });
  });

  it("can rescan all active listings when requested", async () => {
    mockEvaluateListingPolicy
      .mockReturnValueOnce({
        decision: "allow",
        label: "allow",
        confidence: 0.1,
        reasons: [],
        matchedSignals: [],
        contentRiskLevel: "allow",
        autonomyRiskLevel: "allow",
        purchaseMode: "public_purchase_allowed",
        autonomyMode: "autonomous_allowed",
        reasonCodes: [],
      })
      .mockReturnValueOnce({
        decision: "review",
        label: "suspicious_capability",
        confidence: 0.8,
        reasons: ["reason"],
        matchedSignals: [],
        contentRiskLevel: "review",
        autonomyRiskLevel: "block",
        purchaseMode: "manual_review_required",
        autonomyMode: "autonomous_blocked",
        reasonCodes: ["unsafe_autonomy"],
      });

    const result = await rescanMarketplaceListingPolicies(
      createSupabaseStub({
        listings: [
          {
            id: "listing-1",
            seller_id: "seller-1",
            title: "Listing 1",
            description: "desc",
            short_description: "short",
            listing_type: "agent",
            tags: [],
            agent_config: null,
            mcp_manifest: null,
            preview_manifest: null,
          },
          {
            id: "listing-2",
            seller_id: "seller-2",
            title: "Listing 2",
            description: "desc",
            short_description: "short",
            listing_type: "agent",
            tags: [],
            agent_config: null,
            mcp_manifest: null,
            preview_manifest: null,
          },
        ],
        existingPolicies: [{ listing_id: "listing-1" }],
      }) as never,
      { onlyMissing: false }
    );

    expect(result).toMatchObject({
      scanned: 2,
      totalCandidates: 2,
      allow: 1,
      review: 1,
      block: 0,
      onlyMissing: false,
    });
    expect(mockSyncListingPolicyReview).toHaveBeenCalledTimes(2);
  });
});
