import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), lease: vi.fn(), save: vi.fn(), request: vi.fn(), verifyAccount: vi.fn(), verifyCustomer: vi.fn(), reconcile: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("./store", () => ({ withBillingLease: mocks.lease, saveBillingLease: mocks.save }));
vi.mock("./subscriptions", () => ({ reconcileSubscription: mocks.reconcile }));
vi.mock("./stripe", async (original) => ({ ...await original<typeof import("./stripe")>(), stripeRequest: mocks.request, verifyBillingAccount: mocks.verifyAccount, verifyDataCustomer: mocks.verifyCustomer }));
import { createDataCheckout, createDataPortal } from "./checkout";
import { billingLease, config, metadata, subscription, userId } from "./fixtures.test-support";
import type { BillingLease } from "./store";

let lease: BillingLease;
let grant: Record<string, unknown> | null;
let enabled: boolean;
let priceAmount: number;
function session() { return { id: "cs_test_fixture", status: "open", url: "https://checkout.stripe.com/c/pay/fixture", customer: "cus_fixture", metadata, livemode: false, mode: "subscription" }; }
beforeEach(() => {
  vi.clearAllMocks(); lease = billingLease({ checkout_attempt_id: null, checkout_attempt_at: null }); grant = null; enabled = true; priceAmount = 4900;
  mocks.lease.mockImplementation(async (_config, _user, fn) => fn(lease));
  mocks.save.mockImplementation(async (_lease, patch) => Object.assign(lease, patch));
  mocks.reconcile.mockResolvedValue(null);
  mocks.admin.mockReturnValue({ from: (table: string) => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: grant, error: null }),
    single: async () => ({ data: table === "data_api_plans" ? { monthly_price_cents: 4900, checkout_enabled: enabled, is_active: true, is_public: true } : null, error: null }),
  }) }) }) });
  mocks.request.mockImplementation(async (_config, path: string) => {
    if (path.startsWith("/prices/")) return { id: "price_pro", unit_amount: priceAmount, currency: "usd", active: true, livemode: false, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, product: { active: true, metadata } };
    if (path === "/customers") return { id: "cus_fixture", livemode: false, metadata };
    if (path.startsWith("/checkout/sessions")) return session();
    if (path.startsWith("/billing_portal/configurations")) return { id: "bpc_fixture", active: true, is_default: false, livemode: false, metadata, features: { subscription_cancel: { enabled: true, mode: "at_period_end" }, subscription_update: { enabled: false }, invoice_history: { enabled: true }, payment_method_update: { enabled: true } } };
    if (path === "/billing_portal/sessions") return { url: "https://billing.stripe.com/p/session/test" };
    throw new Error(`Unexpected mocked Stripe request ${path}`);
  });
});
describe("checkout and portal safety", () => {
  it("creates a customer scoped to the app and persists a repeatable checkout attempt", async () => {
    lease.customer_id = null;
    expect(await createDataCheckout(config, { id: userId }, "pro")).toBe(session().url);
    expect(mocks.verifyAccount).toHaveBeenCalledWith(config, true);
    expect(mocks.verifyCustomer).toHaveBeenCalledWith(config, "cus_fixture", userId);
    const call = mocks.request.mock.calls.find(([, path]) => path === "/checkout/sessions")!;
    expect(call[2].get("mode")).toBe("subscription");
    expect(call[2].get("subscription_data[metadata][checkout_attempt_id]")).toBe(lease.checkout_attempt_id);
    expect(call[2].get("line_items[0][price]")).toBe("price_pro");
    expect(call[3]).toBe(`aimc-data-checkout:${lease.checkout_attempt_id}`);
    expect(lease.checkout_session_id).toBe("cs_test_fixture");
  });
  it("reuses the open checkout rather than creating a second payable session", async () => {
    lease.checkout_session_id = "cs_test_fixture";
    expect(await createDataCheckout(config, { id: userId }, "pro")).toBe(session().url);
    expect(mocks.request.mock.calls.some(([, path, body]) => path === "/checkout/sessions" && body)).toBe(false);
  });
  it("rejects overlapping subscriptions, even before their first invoice is paid", async () => {
    mocks.reconcile.mockResolvedValue(subscription({ status: "incomplete" }));
    await expect(createDataCheckout(config, { id: userId }, "pro")).rejects.toThrow("already have a subscription");
  });
  it("preserves active pilot grants", async () => {
    grant = { source: "admin", status: "active", current_period_end: null };
    await expect(createDataCheckout(config, { id: userId }, "pro")).rejects.toThrow("current data access");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rejects prices that do not match published plans", async () => {
    priceAmount = 19900;
    await expect(createDataCheckout(config, { id: userId }, "pro")).rejects.toThrow("published data plan");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("requires the plan's explicit checkout gate", async () => {
    enabled = false;
    await expect(createDataCheckout(config, { id: userId }, "pro")).rejects.toThrow("not available");
  });
  it("blocks uncertain retries after Stripe's idempotency retention window", async () => {
    lease = billingLease({ checkout_attempt_at: new Date(Date.now() - 24 * 3600_000).toISOString() });
    await expect(createDataCheckout(config, { id: userId }, "pro")).rejects.toThrow("support reconciliation");
  });
  it("blocks another plan while an earlier checkout is open", async () => {
    lease.checkout_session_id = "cs_test_fixture"; lease.checkout_plan_slug = "business";
    await expect(createDataCheckout(config, { id: userId }, "pro")).rejects.toThrow("another plan");
  });
  it("never looks up a shared customer by email", async () => {
    lease.customer_id = null;
    await createDataCheckout(config, { id: userId }, "pro");
    expect(mocks.request.mock.calls.some(([, path]) => String(path).includes("email="))).toBe(false);
  });
  it("creates a portal only for the server-side linked customer and dedicated configuration", async () => {
    expect(await createDataPortal(config, userId)).toBe("https://billing.stripe.com/p/session/test");
    const call = mocks.request.mock.calls.find(([, path]) => path === "/billing_portal/sessions")!;
    expect(call[2].get("customer")).toBe("cus_fixture"); expect(call[2].get("configuration")).toBe("bpc_fixture");
  });
  it("does not create a portal for an unlinked account", async () => {
    lease.customer_id = null;
    await expect(createDataPortal(config, userId)).rejects.toThrow("No data billing account");
  });
  it.each(["shared-default", "cancellation-disabled", "plan-updates-enabled"])("rejects unsafe portal configuration: %s", async (variant) => {
    const implementation = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation(async (...args) => {
      const value = await implementation(...args);
      if (String(args[1]).startsWith("/billing_portal/configurations")) {
        if (variant === "shared-default") value.is_default = true;
        if (variant === "cancellation-disabled") value.features.subscription_cancel.enabled = false;
        if (variant === "plan-updates-enabled") value.features.subscription_update.enabled = true;
      }
      return value;
    });
    await expect(createDataPortal(config, userId)).rejects.toThrow("not configured correctly");
    expect(mocks.request.mock.calls.some(([, path]) => path === "/billing_portal/sessions")).toBe(false);
  });
});
