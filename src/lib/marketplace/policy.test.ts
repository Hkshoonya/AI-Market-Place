import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTONOMOUS_COMMERCE_POLICY,
  evaluateListingPolicy,
  enforceAutonomousCommerceGuardrails,
} from "./policy";

function createGuardrailSupabase(options?: {
  policy?: Partial<typeof DEFAULT_AUTONOMOUS_COMMERCE_POLICY> | null;
  sellerVerified?: boolean;
  flaggedDecision?: "review" | "block" | null;
  dailyOrders?: Array<{ price_at_time: number | null; status: string; message: string | null }>;
}) {
  return {
    from(table: string) {
      if (table === "autonomous_commerce_policies") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: options?.policy
                  ? { owner_id: "buyer-1", ...DEFAULT_AUTONOMOUS_COMMERCE_POLICY, ...options.policy }
                  : null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { seller_verified: options?.sellerVerified ?? true },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "listing_policy_reviews") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: options?.flaggedDecision
                      ? [
                          {
                            decision: options.flaggedDecision,
                            review_status: "open",
                          },
                        ]
                      : [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "marketplace_orders") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: async () => ({
                  data: options?.dailyOrders ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("evaluateListingPolicy", () => {
  it("blocks obvious illegal goods listings", () => {
    const result = evaluateListingPolicy({
      title: "Fresh stolen credentials combo list",
      description: "Buy stealer logs, cracked accounts, and phishing kit access.",
      shortDescription: null,
      listingType: "dataset",
      tags: ["credentials", "logs"],
      agentConfig: null,
      mcpManifest: null,
    });

    expect(result.decision).toBe("block");
    expect(result.label).toBe("illegal_goods");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("routes ambiguous exploit-oriented listings to review", () => {
    const result = evaluateListingPolicy({
      title: "Credential bypass research agent",
      description: "Automation pack for bypass testing, payload simulation, and exploit workflow rehearsal.",
      shortDescription: null,
      listingType: "agent",
      tags: ["security", "research"],
      agentConfig: { tools: ["payload-runner"] },
      mcpManifest: null,
    });

    expect(result.decision).toBe("review");
    expect(result.label).toBe("suspicious_capability");
  });

  it("allows normal marketplace listings", () => {
    const result = evaluateListingPolicy({
      title: "Open-source eval dashboard",
      description: "A hosted analytics dashboard for model quality tracking.",
      shortDescription: "Evaluation dashboard",
      listingType: "agent",
      tags: ["analytics", "evaluation"],
      agentConfig: { capabilities: ["reporting"] },
      mcpManifest: { tools: [{ name: "generate-report" }] },
    });

    expect(result.decision).toBe("allow");
    expect(result.label).toBe("allow");
  });
});

describe("enforceAutonomousCommerceGuardrails", () => {
  const listing = {
    id: "listing-1",
    seller_id: "seller-1",
    listing_type: "agent",
    price: 150,
  };

  it("allows session purchases without autonomous caps", async () => {
    const result = await enforceAutonomousCommerceGuardrails(
      createGuardrailSupabase() as never,
      {
        buyerId: "buyer-1",
        authMethod: "session",
        listing,
      }
    );

    expect(result.allowed).toBe(true);
  });

  it("rejects API-key purchases above the per-order cap", async () => {
    const result = await enforceAutonomousCommerceGuardrails(
      createGuardrailSupabase({
        policy: { max_order_amount: 100 },
      }) as never,
      {
        buyerId: "buyer-1",
        authMethod: "api_key",
        listing,
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("max_order_amount_exceeded");
  });

  it("rejects API-key purchases when the seller is not verified and policy requires it", async () => {
    const result = await enforceAutonomousCommerceGuardrails(
      createGuardrailSupabase({
        policy: { max_order_amount: 250, require_verified_sellers: true },
        sellerVerified: false,
      }) as never,
      {
        buyerId: "buyer-1",
        authMethod: "api_key",
        listing,
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("seller_not_verified");
  });

  it("rejects API-key purchases when a listing has an unresolved policy review", async () => {
    const result = await enforceAutonomousCommerceGuardrails(
      createGuardrailSupabase({
        policy: { max_order_amount: 250, block_flagged_listings: true },
        flaggedDecision: "review",
      }) as never,
      {
        buyerId: "buyer-1",
        authMethod: "api_key",
        listing,
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("listing_under_review");
  });

  it("rejects API-key purchases when the daily spend cap would be exceeded", async () => {
    const result = await enforceAutonomousCommerceGuardrails(
      createGuardrailSupabase({
        policy: { max_order_amount: 250, daily_spend_limit: 200 },
        dailyOrders: [
          { price_at_time: 75, status: "completed", message: "Purchased via API" },
          { price_at_time: 60, status: "pending", message: "Purchased via API" },
        ],
      }) as never,
      {
        buyerId: "buyer-1",
        authMethod: "api_key",
        listing: { ...listing, price: 80 },
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("daily_spend_limit_exceeded");
  });
});
