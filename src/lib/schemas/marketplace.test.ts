import { describe, expect, it } from "vitest";
import {
  MarketplaceListingSchema,
  MarketplaceOrderSchema,
} from "./marketplace";

const validListing = {
  id: "listing-1",
  seller_id: "seller-1",
  slug: "protocol-agent-kit",
  title: "Protocol Agent Kit",
  description: "A machine-readable agent package.",
  short_description: "Agent package",
  listing_type: "agent",
  status: "active",
  pricing_type: "one_time",
  price: 49,
  currency: "USD",
  model_id: null,
  tags: ["agent", "protocol"],
  thumbnail_url: null,
  demo_url: "https://example.com/demo",
  documentation_url: "https://example.com/docs",
  view_count: 12,
  inquiry_count: 1,
  avg_rating: 4.8,
  review_count: 3,
  is_featured: false,
  agent_config: null,
  mcp_manifest: null,
  preview_manifest: {
    schema_version: "1.0",
    fulfillment_type: "agent_package",
    title: "Protocol Agent Kit",
    summary: "Safe preview",
  },
  agent_id: null,
  created_at: "2026-03-14T00:00:00Z",
  updated_at: "2026-03-14T00:00:00Z",
};

const validOrder = {
  id: "order-1",
  listing_id: "listing-1",
  buyer_id: "buyer-1",
  seller_id: "seller-1",
  status: "completed",
  message: null,
  price_at_time: 49,
  delivery_data: {
    type: "agent",
    agent_slug: "protocol-agent-kit-buyer",
  },
  fulfillment_manifest_snapshot: {
    schema_version: "1.0",
    listing_slug: "protocol-agent-kit",
    fulfillment_type: "agent_package",
    purchased_at: "2026-03-14T00:00:00Z",
  },
  created_at: "2026-03-14T00:00:00Z",
  updated_at: "2026-03-14T00:00:00Z",
};

describe("MarketplaceListingSchema", () => {
  it("accepts preview manifests for listing rows", () => {
    const result = MarketplaceListingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preview_manifest).toEqual(validListing.preview_manifest);
    }
  });
});

describe("MarketplaceOrderSchema", () => {
  it("accepts fulfillment manifest snapshots for order rows", () => {
    const result = MarketplaceOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fulfillment_manifest_snapshot).toEqual(
        validOrder.fulfillment_manifest_snapshot
      );
    }
  });
});
