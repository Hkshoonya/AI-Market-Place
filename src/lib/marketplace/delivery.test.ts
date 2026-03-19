import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import { deliverDigitalGood } from "./delivery";

function createMockSupabase(options?: {
  listing?: Record<string, unknown>;
  order?: Record<string, unknown>;
  profileExists?: boolean;
  orderUpdates?: Record<string, unknown>[];
}) {
  const orderUpdates = options?.orderUpdates ?? [];
  const listing = options?.listing ?? {
    id: "listing-1",
    title: "Agent Access",
    slug: "agent-access",
    listing_type: "api_access",
    description: "Listing",
    short_description: "Listing",
    pricing_type: "one_time",
    price: 10,
    currency: "USD",
    tags: ["api"],
    documentation_url: null,
    demo_url: null,
    agent_config: null,
    mcp_manifest: null,
    preview_manifest: null,
  };
  const order = options?.order ?? {
    id: "order-1",
    listing_id: "listing-1",
    buyer_id: "buyer-1",
    seller_id: "seller-1",
    created_at: "2026-03-14T12:00:00Z",
    fulfillment_manifest_snapshot: null,
    delivery_data: null,
  };

  return {
    from: (table: string) => {
      if (table === "marketplace_listings") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: listing,
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "marketplace_orders") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: order,
                  error: null,
                }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            orderUpdates.push(payload);
            return {
              eq: () => Promise.resolve({ data: null, error: null }),
            };
          },
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: options?.profileExists === false ? null : { id: "buyer-1" },
                  error: options?.profileExists === false ? { message: "not found" } : null,
                }),
            }),
          }),
        };
      }

      if (table === "api_keys") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "key-1", key_prefix: "aimk_123456" },
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "agents") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "agent-1", slug: "agent-access-buyer" },
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

describe("deliverDigitalGood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses account-bound delivery when the buyer does not resolve to a profile", async () => {
    mockCreateAdminClient.mockReturnValue(
      createMockSupabase({ profileExists: false })
    );

    const result = await deliverDigitalGood(
      "order-1",
      "listing-1",
      "guest-order-reference"
    );

    expect(result.success).toBe(false);
    expect(result.deliveryType).toBe("api_access");
    expect(result.error).toMatch(/account required/i);
  });

  it("snapshots a fulfillment manifest onto the order before delivery", async () => {
    const orderUpdates: Record<string, unknown>[] = [];
    mockCreateAdminClient.mockReturnValue(
      createMockSupabase({
        listing: {
          id: "listing-1",
          title: "Prompt Pack",
          slug: "prompt-pack",
          listing_type: "prompt_template",
          description: "Prompt body",
          short_description: "Prompt preview",
          pricing_type: "one_time",
          price: 12,
          currency: "USD",
          tags: ["prompt"],
          documentation_url: null,
          demo_url: null,
          agent_config: null,
          mcp_manifest: null,
          preview_manifest: {
            schema_version: "1.0",
            fulfillment_type: "prompt_content",
            title: "Prompt Pack",
            summary: "Prompt preview",
            capabilities: ["prompt"],
            pricing_model: { model: "one_time", price: 12, currency: "USD" },
          },
        },
        orderUpdates,
      })
    );

    const result = await deliverDigitalGood("order-1", "listing-1", "buyer-1");

    expect(result.success).toBe(true);
    expect(orderUpdates[0]?.fulfillment_manifest_snapshot).toEqual(
      expect.objectContaining({
        schema_version: "1.0",
        listing_slug: "prompt-pack",
        order_id: "order-1",
      })
    );
  });

  it("prefers the stored fulfillment snapshot over the live listing manifest", async () => {
    mockCreateAdminClient.mockReturnValue(
      createMockSupabase({
        listing: {
          id: "listing-1",
          title: "MCP Server",
          slug: "mcp-server",
          listing_type: "mcp_server",
          description: "Listing",
          short_description: "Listing",
          pricing_type: "monthly_subscription",
          price: 19,
          currency: "USD",
          tags: ["mcp"],
          documentation_url: null,
          demo_url: null,
          agent_config: null,
          mcp_manifest: {
            endpoint: "https://new.example.com/mcp",
            tools: [{ name: "search" }],
          },
          preview_manifest: null,
        },
        order: {
          id: "order-1",
          listing_id: "listing-1",
          buyer_id: "buyer-1",
          seller_id: "seller-1",
          created_at: "2026-03-14T12:00:00Z",
          fulfillment_manifest_snapshot: {
            schema_version: "1.0",
            fulfillment_type: "mcp_endpoint",
            listing_slug: "mcp-server",
            access: {
              endpoint: "https://snapshot.example.com/mcp",
            },
            artifacts: {
              tools: [{ name: "search" }, { name: "summarize" }],
            },
          },
        },
      })
    );

    const result = await deliverDigitalGood("order-1", "listing-1", "buyer-1");

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        endpoint: "https://snapshot.example.com/mcp",
        tools: [{ name: "search" }, { name: "summarize" }],
      })
    );
  });

  it("reuses existing api access delivery metadata instead of minting a second key", async () => {
    const orderUpdates: Record<string, unknown>[] = [];
    mockCreateAdminClient.mockReturnValue(
      createMockSupabase({
        order: {
          id: "order-1",
          listing_id: "listing-1",
          buyer_id: "buyer-1",
          seller_id: "seller-1",
          created_at: "2026-03-14T12:00:00Z",
          fulfillment_manifest_snapshot: null,
          delivery_data: {
            type: "api_access",
            key_id: "key-1",
            key_prefix: "aimk_saved",
          },
        },
        orderUpdates,
      })
    );

    const result = await deliverDigitalGood("order-1", "listing-1", "buyer-1");

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      key_prefix: "aimk_saved",
      reused: true,
    });
    expect(orderUpdates).toHaveLength(1);
  });

  it("reuses existing agent delivery metadata instead of creating a duplicate agent", async () => {
    const orderUpdates: Record<string, unknown>[] = [];
    mockCreateAdminClient.mockReturnValue(
      createMockSupabase({
        listing: {
          id: "listing-1",
          title: "Agent Access",
          slug: "agent-access",
          listing_type: "agent",
          description: "Listing",
          short_description: "Listing",
          pricing_type: "one_time",
          price: 10,
          currency: "USD",
          tags: ["agent"],
          documentation_url: null,
          demo_url: null,
          agent_config: { capabilities: ["research"] },
          mcp_manifest: null,
          preview_manifest: null,
        },
        order: {
          id: "order-1",
          listing_id: "listing-1",
          buyer_id: "buyer-1",
          seller_id: "seller-1",
          created_at: "2026-03-14T12:00:00Z",
          fulfillment_manifest_snapshot: null,
          delivery_data: {
            type: "agent",
            agent_id: "agent-1",
            agent_slug: "agent-access-buyer",
          },
        },
        orderUpdates,
      })
    );

    const result = await deliverDigitalGood("order-1", "listing-1", "buyer-1");

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      agent_id: "agent-1",
      agent_slug: "agent-access-buyer",
      reused: true,
    });
    expect(orderUpdates).toHaveLength(1);
  });
});
