import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), lease: vi.fn(), save: vi.fn(), apply: vi.fn(), retrieve: vi.fn(), request: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("./store", () => ({ withBillingLease: mocks.lease, saveBillingLease: mocks.save }));
vi.mock("./subscriptions", () => ({ applySubscription: mocks.apply, retrieveDataSubscription: mocks.retrieve }));
vi.mock("./stripe", async (original) => ({ ...await original<typeof import("./stripe")>(), stripeRequest: mocks.request, verifyBillingAccount: mocks.verify }));
import { processDataBillingEvent, readDataBillingEvent } from "./webhook";
import { billingLease, config, metadata, subscription, userId } from "./fixtures.test-support";

function signed(body: string, stamp = Math.floor(Date.now() / 1000), header?: string) {
  const hash = createHmac("sha256", config.webhookSecret).update(`${stamp}.${body}`).digest("hex");
  return new Request("https://test.example/webhook", { method: "POST", headers: { "stripe-signature": header ?? `t=${stamp},v1=${hash}` }, body });
}
function event(object: unknown = subscription(), type = "customer.subscription.updated") {
  return { id: "evt_fixture", type, livemode: false, data: { object } };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: userId }, error: null }) }) }) }) });
  mocks.lease.mockImplementation(async (_config, _userId, fn) => fn(billingLease()));
  mocks.retrieve.mockResolvedValue(subscription());
});
describe("bounded signed subscription webhook", () => {
  it("verifies exact raw bytes", async () => {
    expect(await readDataBillingEvent(signed(JSON.stringify(event())), config.webhookSecret)).toMatchObject({ id: "evt_fixture" });
  });
  it("rejects absent, expired and malformed signatures", async () => {
    const body = JSON.stringify(event());
    await expect(readDataBillingEvent(signed(body, 1), config.webhookSecret)).rejects.toThrow("Expired");
    await expect(readDataBillingEvent(signed(body, undefined, "t=123oops,v1=aa"), config.webhookSecret)).rejects.toThrow("Invalid");
    await expect(readDataBillingEvent(new Request("https://test.example"), config.webhookSecret)).rejects.toThrow("Invalid");
  });
  it("caps chunked payloads even without content-length", async () => {
    await expect(readDataBillingEvent(signed("x".repeat(1_000_001)), config.webhookSecret)).rejects.toThrow("too large");
  });
  it("rejects trailing data after an otherwise valid signature", async () => {
    const body = JSON.stringify(event());
    const request = signed(body);
    request.headers.set("stripe-signature", `${request.headers.get("stripe-signature")}=suffix`);
    await expect(readDataBillingEvent(request, config.webhookSecret)).rejects.toThrow("Invalid");
  });
  it("ignores test events on live deployments before any database or Stripe call", async () => {
    expect(await processDataBillingEvent({ ...config, livemode: true }, event())).toEqual({ ignored: true });
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("ignores unrelated shared-account subscription metadata", async () => {
    expect(await processDataBillingEvent(config, event(subscription({ metadata: { app: "fitness" } })))).toEqual({ ignored: true });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("uses a fresh Stripe snapshot rather than the delivered subscription status", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ status: "canceled" }));
    await processDataBillingEvent(config, event());
    expect(mocks.apply).toHaveBeenCalledWith(config, expect.anything(), expect.objectContaining({ status: "canceled" }), { id: "evt_fixture", type: "customer.subscription.updated" });
  });
  it("does not let a stale subscription replace a newer checkout", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ metadata: { ...metadata, checkout_attempt_id: "old" } }));
    expect(await processDataBillingEvent(config, event())).toEqual({ ignored: true });
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("holds access on refunds using the current invoice-payments API", async () => {
    mocks.request.mockResolvedValueOnce({ has_more: false, data: [{ invoice: "in_fixture" }] })
      .mockResolvedValueOnce({ customer: "cus_fixture", livemode: false, parent: { subscription_details: { subscription: "sub_fixture" } } });
    await processDataBillingEvent(config, event({ id: "ch_fixture", customer: "cus_fixture", payment_intent: "pi_fixture", livemode: false }, "charge.refunded"));
    expect(mocks.request.mock.calls[0][1]).toContain("invoice_payments?");
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), { access_hold: true });
    expect(mocks.apply).toHaveBeenCalledOnce();
  });
});
