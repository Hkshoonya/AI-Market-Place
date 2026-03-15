import { describe, expect, it } from "vitest";

import {
  buildListingPreviewManifest,
  buildOrderFulfillmentManifest,
} from "./manifest";

const baseListing = {
  id: "listing-1",
  slug: "agent-protocol-kit",
  title: "Agent Protocol Kit",
  description: "A packaged autonomous agent workflow.",
  short_description: "Autonomous agent workflow",
  listing_type: "agent",
  pricing_type: "one_time",
  price: 49,
  currency: "USD",
  documentation_url: "https://example.com/docs",
  demo_url: "https://example.com/demo",
  tags: ["agent", "automation"],
  agent_config: null,
  mcp_manifest: null,
  preview_manifest: null,
} as const;

describe("buildListingPreviewManifest", () => {
  it("builds a preview manifest from a skill manifest", () => {
    const preview = buildListingPreviewManifest({
      ...baseListing,
      agent_config: {
        skill_manifest: {
          name: "Agent Protocol Kit",
          version: "1.2.0",
          type: "agent",
          capabilities: ["automation", "orchestration"],
          runtime: "node",
          input_schema: { type: "object" },
          output_schema: { type: "object" },
        },
      },
    });

    expect(preview.schema_version).toBe("1.0");
    expect(preview.fulfillment_type).toBe("agent_package");
    expect(preview.capabilities).toEqual(["automation", "orchestration"]);
    expect(preview.runtime).toEqual(
      expect.objectContaining({ environment: "node" })
    );
  });

  it("builds a preview manifest from an mcp manifest", () => {
    const preview = buildListingPreviewManifest({
      ...baseListing,
      listing_type: "mcp_server",
      mcp_manifest: {
        endpoint: "https://example.com/mcp",
        tools: [{ name: "search" }, { name: "summarize" }],
      },
    });

    expect(preview.fulfillment_type).toBe("mcp_endpoint");
    expect(preview.access).toEqual(
      expect.objectContaining({ endpoint: "https://example.com/mcp" })
    );
    expect(preview.capabilities).toEqual(["search", "summarize"]);
  });

  it("falls back to listing metadata when no explicit manifest exists", () => {
    const preview = buildListingPreviewManifest(baseListing);

    expect(preview.title).toBe("Agent Protocol Kit");
    expect(preview.summary).toBe("Autonomous agent workflow");
    expect(preview.pricing_model).toEqual(
      expect.objectContaining({ model: "one_time", price: 49, currency: "USD" })
    );
  });
});

describe("buildOrderFulfillmentManifest", () => {
  it("snapshots a purchased contract from listing and order metadata", () => {
    const manifest = buildOrderFulfillmentManifest({
      listing: {
        ...baseListing,
        preview_manifest: {
          schema_version: "1.0",
          fulfillment_type: "agent_package",
          title: "Agent Protocol Kit",
          summary: "Autonomous agent workflow",
          capabilities: ["automation"],
          access: { mode: "download" },
          pricing_model: { model: "one_time", price: 49, currency: "USD" },
        },
      },
      order: {
        id: "order-1",
        listing_id: "listing-1",
        buyer_id: "buyer-1",
        seller_id: "seller-1",
        created_at: "2026-03-14T12:00:00Z",
        price_at_time: 49,
      },
    });

    expect(manifest.schema_version).toBe("1.0");
    expect(manifest.listing_slug).toBe("agent-protocol-kit");
    expect(manifest.order_id).toBe("order-1");
    expect(manifest.purchased_at).toBe("2026-03-14T12:00:00Z");
    expect(manifest.pricing_model).toEqual(
      expect.objectContaining({ price: 49, currency: "USD" })
    );
  });
});
