import { afterEach, describe, expect, it, vi } from "vitest";
import { dataBillingCheckoutEnabled, dataBillingConfigured, getDataBillingConfig, safeStripeUrl } from "./config";

function configure() {
  vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_fixture");
  vi.stubEnv("STRIPE_DATA_WEBHOOK_SECRET", "whsec_fixture");
  vi.stubEnv("STRIPE_EXPECTED_ACCOUNT_ID", "acct_fixture");
  vi.stubEnv("STRIPE_DATA_PRO_PRICE_ID", "price_pro");
  vi.stubEnv("STRIPE_DATA_BUSINESS_PRICE_ID", "price_business");
  vi.stubEnv("STRIPE_DATA_PORTAL_CONFIGURATION_ID", "bpc_fixture");
  vi.stubEnv("DATA_API_BILLING_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://aimarketcap.tech");
}
afterEach(() => vi.unstubAllEnvs());
describe("separate data billing configuration", () => {
  it("does not use the wallet flag to enable data subscriptions", () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED", "true");
    vi.stubEnv("DATA_API_BILLING_ENABLED", "false");
    expect(dataBillingCheckoutEnabled()).toBe(false);
  });
  it("accepts restricted credentials but needs its dedicated webhook and prices", () => {
    configure(); expect(getDataBillingConfig().livemode).toBe(true);
    vi.stubEnv("STRIPE_DATA_WEBHOOK_SECRET", ""); expect(dataBillingConfigured()).toBe(false);
  });
  it.each(["sk_live_fixture", "rk_test_fixture", "garbage"])("rejects unsuitable live credential %s", (key) => {
    configure(); vi.stubEnv("STRIPE_SECRET_KEY", key); expect(dataBillingConfigured()).toBe(false);
  });
  it("rejects shared price ids and HTTP live origins", () => {
    configure(); vi.stubEnv("STRIPE_DATA_BUSINESS_PRICE_ID", "price_pro"); expect(dataBillingConfigured()).toBe(false);
    configure(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://example.com"); expect(dataBillingConfigured()).toBe(false);
  });
  it.each(["https://checkout.stripe.com.evil.example/x", "https://attacker@checkout.stripe.com/x", "javascript:alert(1)", "http://checkout.stripe.com/x"])("rejects unsafe redirect %s", (url) => {
    expect(() => safeStripeUrl(url, "checkout.stripe.com")).toThrow();
  });
});
