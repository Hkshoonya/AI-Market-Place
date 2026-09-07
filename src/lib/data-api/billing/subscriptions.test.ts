import { describe, expect, it } from "vitest";
import { subscriptionSnapshot } from "./subscriptions";
import { billingLease, config, subscription } from "./fixtures.test-support";

describe("verified paid entitlement snapshots", () => {
  it("grants active access for the approved paid subscription", () => {
    expect(subscriptionSnapshot(config, billingLease(), subscription())).toMatchObject({ plan: "pro", status: "active", end: "2026-10-01T00:00:00.000Z" });
  });
  it.each(["trialing", "incomplete", "paused"])("does not grant access for %s", (status) => {
    expect(subscriptionSnapshot(config, billingLease(), subscription({ status })).status).toBe("expired");
  });
  it.each(["open", "uncollectible", "draft"])("does not grant access for an invoice that is %s", (status) => {
    expect(subscriptionSnapshot(config, billingLease(), subscription({ latest_invoice: { status, customer: "cus_fixture", livemode: false } })).status).toBe("expired");
  });
  it("suspends past-due access and honors cancellation", () => {
    expect(subscriptionSnapshot(config, billingLease(), subscription({ status: "past_due" })).status).toBe("past_due");
    expect(subscriptionSnapshot(config, billingLease(), subscription({ status: "canceled" })).status).toBe("canceled");
    expect(subscriptionSnapshot(config, billingLease(), subscription({ cancel_at_period_end: true })).status).toBe("active");
  });
  it("honors portal cancellation timestamps without relying on the legacy boolean", () => {
    const scheduled = subscription({ cancel_at_period_end: false, cancel_at: 1790812800 });
    expect(subscriptionSnapshot(config, billingLease(), scheduled)).toMatchObject({
      status: "active", end: "2026-10-01T00:00:00.000Z",
    });
    expect(subscriptionSnapshot(config, billingLease(), { ...scheduled, status: "canceled" }).status).toBe("canceled");
  });
  it("fails closed for paused collection and foreign invoice customers", () => {
    expect(subscriptionSnapshot(config, billingLease(), subscription({ pause_collection: { behavior: "void" } })).status).toBe("expired");
    expect(subscriptionSnapshot(config, billingLease(), subscription({ latest_invoice: { status: "paid", customer: "cus_foreign", livemode: false } })).status).toBe("expired");
  });
  it.each([{ customer: "cus_foreign" }, { livemode: true }, { metadata: { app: "other" } }])("rejects a foreign subscription %j", (patch) => {
    expect(() => subscriptionSnapshot(config, billingLease(), subscription(patch))).toThrow();
  });
  it("revokes access for an unapproved price or multiple subscription items", () => {
    const s = subscription(); s.items.data[0].price.id = "price_unapproved";
    expect(subscriptionSnapshot(config, billingLease(), s).status).toBe("expired");
    const multiple = subscription(); multiple.items.data.push(multiple.items.data[0]);
    expect(subscriptionSnapshot(config, billingLease(), multiple).status).toBe("expired");
  });
  it("rejects missing and invalid billing periods", () => {
    const s = subscription(); s.items.data[0].current_period_end = 0;
    expect(() => subscriptionSnapshot(config, billingLease(), s)).toThrow("Invalid subscription period");
  });
});
