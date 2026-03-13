import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import { deliverDigitalGood } from "./delivery";

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === "marketplace_listings") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "listing-1",
                    title: "Agent Access",
                    slug: "agent-access",
                    listing_type: "api_access",
                    description: "Listing",
                    documentation_url: null,
                    demo_url: null,
                    agent_config: null,
                    mcp_manifest: null,
                  },
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
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "not found" },
                }),
            }),
          }),
        };
      }

      if (table === "api_keys") {
        return {
          insert: vi.fn(),
        };
      }

      return {};
    },
  };
}

describe("deliverDigitalGood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(createMockSupabase());
  });

  it("refuses account-bound delivery when the buyer does not resolve to a profile", async () => {
    const result = await deliverDigitalGood(
      "order-1",
      "listing-1",
      "guest-order-reference"
    );

    expect(result.success).toBe(false);
    expect(result.deliveryType).toBe("api_access");
    expect(result.error).toMatch(/account required/i);
  });
});
