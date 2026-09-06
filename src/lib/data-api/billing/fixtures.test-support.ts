import type { DataBillingConfig } from "./config";
import type { BillingLease } from "./store";

export const config: DataBillingConfig = {
  secretKey: "rk_test_fixture", webhookSecret: "whsec_fixture", accountId: "acct_fixture", livemode: false,
  origin: "https://billing-test.example", prices: { pro: "price_pro", business: "price_business" }, portalConfiguration: "bpc_fixture",
};
export const userId = "11111111-1111-4111-8111-111111111111";
export const metadata = { app: "aimarketcap", purpose: "data_subscription", user_id: userId, checkout_attempt_id: "22222222-2222-4222-8222-222222222222" };
export function billingLease(overrides: Partial<BillingLease> = {}): BillingLease {
  return {
    user_id: userId, customer_id: "cus_fixture", subscription_id: null, customer_request_id: "33333333-3333-4333-8333-333333333333",
    checkout_attempt_id: metadata.checkout_attempt_id, checkout_attempt_at: new Date().toISOString(), checkout_plan_slug: "pro", checkout_session_id: null,
    lease_token: "44444444-4444-4444-8444-444444444444", lease_until: new Date(Date.now() + 120_000).toISOString(),
    last_synced_at: "1970-01-01T00:00:00Z", last_checked_at: "1970-01-01T00:00:00Z", access_hold: false, deletion_pending: false, created_at: new Date().toISOString(), ...overrides,
  };
}
export function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_fixture", customer: "cus_fixture", livemode: false, metadata, status: "active",
    latest_invoice: { id: "in_fixture", customer: "cus_fixture", livemode: false, status: "paid" },
    items: { has_more: false, data: [{ quantity: 1, current_period_start: 1788220800, current_period_end: 1790812800,
      price: { id: "price_pro", currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] },
    ...overrides,
  };
}
