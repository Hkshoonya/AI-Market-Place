import { describe, expect, it } from "vitest";

import { selectLatestListingPolicies } from "./policy-read";

describe("marketplace policy read helpers", () => {
  it("keeps the latest policy row per listing", () => {
    const result = selectLatestListingPolicies([
      {
        listing_id: "listing-1",
        purchase_mode: "manual_review_required",
        autonomy_mode: "manual_only",
        content_risk_level: "allow",
        autonomy_risk_level: "manual_only",
        created_at: "2026-03-16T10:00:00.000Z",
        updated_at: "2026-03-16T10:00:00.000Z",
      },
      {
        listing_id: "listing-1",
        purchase_mode: "public_purchase_allowed",
        autonomy_mode: "autonomous_allowed",
        content_risk_level: "allow",
        autonomy_risk_level: "allow",
        created_at: "2026-03-16T10:05:00.000Z",
        updated_at: "2026-03-16T10:05:00.000Z",
      },
      {
        listing_id: "listing-2",
        purchase_mode: "purchase_blocked",
        autonomy_mode: "autonomous_blocked",
        content_risk_level: "block",
        autonomy_risk_level: "block",
        created_at: "2026-03-16T10:01:00.000Z",
        updated_at: "2026-03-16T10:01:00.000Z",
      },
    ]);

    expect(result.get("listing-1")).toMatchObject({
      purchase_mode: "public_purchase_allowed",
      autonomy_mode: "autonomous_allowed",
    });
    expect(result.get("listing-2")).toMatchObject({
      purchase_mode: "purchase_blocked",
      autonomy_mode: "autonomous_blocked",
    });
  });

  it("falls back to created_at when updated_at is missing", () => {
    const result = selectLatestListingPolicies([
      {
        listing_id: "listing-1",
        purchase_mode: "manual_review_required",
        autonomy_mode: "manual_only",
        content_risk_level: "allow",
        autonomy_risk_level: "manual_only",
        created_at: "2026-03-16T10:00:00.000Z",
        updated_at: null,
      },
      {
        listing_id: "listing-1",
        purchase_mode: "public_purchase_allowed",
        autonomy_mode: "restricted",
        content_risk_level: "allow",
        autonomy_risk_level: "restricted",
        created_at: "2026-03-16T11:00:00.000Z",
        updated_at: null,
      },
    ]);

    expect(result.get("listing-1")).toMatchObject({
      purchase_mode: "public_purchase_allowed",
      autonomy_mode: "restricted",
    });
  });
});
