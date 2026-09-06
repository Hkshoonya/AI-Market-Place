import { describe, expect, it } from "vitest";
import { buildRevenueAlerts } from "./alerts";

describe("revenue operations alerts", () => {
  it("does not describe an empty affiliate inventory as ready to earn", () => {
    const alerts = buildRevenueAlerts({ activeAffiliateLinks: 0, overdueLeads: 0, expiringGrants: 0 });
    expect(alerts.filter((alert) => alert.active).map((alert) => alert.slug)).toEqual(["revenue-affiliate-setup"]);
  });
  it("flags follow-ups and renewals without counting them as revenue", () => {
    const alerts = buildRevenueAlerts({ activeAffiliateLinks: 2, overdueLeads: 3, expiringGrants: 1 });
    expect(alerts.filter((alert) => alert.active).map((alert) => alert.slug)).toEqual(["revenue-overdue-leads", "revenue-expiring-grants"]);
  });
  it("resolves operational alerts when there is no pending action", () => {
    expect(buildRevenueAlerts({ activeAffiliateLinks: 1, overdueLeads: 0, expiringGrants: 0 }).every((alert) => !alert.active)).toBe(true);
  });
});
