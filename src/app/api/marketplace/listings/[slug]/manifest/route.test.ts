import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSupabaseClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockSupabaseClient(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, reset: 60 })),
  RATE_LIMITS: { public: { limit: 30, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { GET } from "./route";

function createSupabaseWithListing(listing: Record<string, unknown>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: listing,
                error: null,
              }),
          }),
        }),
      }),
    }),
  };
}

describe("GET /api/marketplace/listings/[slug]/manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a normalized preview manifest when preview_manifest is present", async () => {
    mockSupabaseClient.mockReturnValue(
      createSupabaseWithListing({
        id: "listing-1",
        slug: "agent-protocol-kit",
        title: "Agent Protocol Kit",
        listing_type: "agent",
        pricing_type: "one_time",
        price: 49,
        currency: "USD",
        agent_config: null,
        status: "active",
        preview_manifest: {
          schema_version: "1.0",
          fulfillment_type: "agent_package",
          title: "Agent Protocol Kit",
          summary: "Safe preview",
        },
      })
    );

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/agent-protocol-kit/manifest"),
      { params: Promise.resolve({ slug: "agent-protocol-kit" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.manifest).toEqual(
      expect.objectContaining({
        schema_version: "1.0",
        fulfillment_type: "agent_package",
        title: "Agent Protocol Kit",
      })
    );
  });

  it("falls back to a normalized preview when only mcp_manifest exists", async () => {
    mockSupabaseClient.mockReturnValue(
      createSupabaseWithListing({
        id: "listing-2",
        slug: "mcp-kit",
        title: "MCP Kit",
        listing_type: "mcp_server",
        pricing_type: "monthly_subscription",
        price: 19,
        currency: "USD",
        status: "active",
        agent_config: null,
        preview_manifest: null,
        mcp_manifest: {
          endpoint: "https://example.com/mcp",
          tools: [{ name: "search" }],
        },
      })
    );

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/mcp-kit/manifest"),
      { params: Promise.resolve({ slug: "mcp-kit" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.manifest).toEqual(
      expect.objectContaining({
        fulfillment_type: "mcp_endpoint",
        access: expect.objectContaining({
          endpoint: "https://example.com/mcp",
        }),
      })
    );
  });
});
