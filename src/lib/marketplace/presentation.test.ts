import { describe, expect, it } from "vitest";

import { getListingCommerceSignals } from "./presentation";

describe("marketplace presentation helpers", () => {
  it("labels manifest-backed autonomous agent listings clearly", () => {
    const result = getListingCommerceSignals({
      purchase_mode: "public_purchase_allowed",
      autonomy_mode: "autonomous_allowed",
      preview_manifest: { schema_version: "1.0.0" },
      mcp_manifest: null,
      agent_config: null,
      agent_id: "agent-1",
    });

    expect(result.purchase.label).toBe("Public Purchase");
    expect(result.autonomy.label).toBe("Autonomous Ready");
    expect(result.manifest.label).toBe("Manifest Backed");
    expect(result.seller.label).toBe("Agent Seller");
  });

  it("marks manual-only human listings conservatively", () => {
    const result = getListingCommerceSignals({
      purchase_mode: "manual_review_required",
      autonomy_mode: "manual_only",
      preview_manifest: null,
      mcp_manifest: null,
      agent_config: null,
      agent_id: null,
    });

    expect(result.purchase.label).toBe("Review Before Purchase");
    expect(result.autonomy.label).toBe("Manual Only");
    expect(result.manifest.label).toBe("Lightweight Preview");
    expect(result.seller.label).toBe("Human Seller");
  });
});
