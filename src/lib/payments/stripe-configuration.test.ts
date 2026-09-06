import { afterEach, describe, expect, it, vi } from "vitest";
import { stripeKeyMode, stripeWalletConfigurationIssues } from "./stripe-configuration";
import { getStripePaymentsReadiness } from "./stripe-readiness";

afterEach(() => vi.unstubAllEnvs());

describe("Stripe wallet configuration", () => {
  it.each([
    ["sk_live_valid", "live"], ["rk_live_valid", "live"],
    ["sk_test_valid", "test"], ["rk_test_valid", "test"],
    ["pk_live_public", null], ["sk_live_...", null], [undefined, null],
  ])("recognizes server key mode %s", (key, mode) => {
    expect(stripeKeyMode(key)).toBe(mode);
  });

  it("requires live credentials, webhook signing and a pinned merchant", () => {
    expect(stripeWalletConfigurationIssues({ secretKey: "sk_test_valid" })).toHaveLength(3);
    expect(stripeWalletConfigurationIssues({ secretKey: "sk_live_valid", webhookSecret: "whsec_valid", expectedAccountId: "acct_valid" })).toEqual([]);
  });

  it("never labels a fully configured test key as ready for wallet funding", () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_valid");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_valid");
    vi.stubEnv("STRIPE_EXPECTED_ACCOUNT_ID", "acct_valid");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_valid");
    expect(getStripePaymentsReadiness()).toMatchObject({ status: "partial", checkoutConfigured: false });
  });

  it("reports incomplete configuration when the launch flag is enabled without keys", () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED", "true");
    for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_EXPECTED_ACCOUNT_ID", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) vi.stubEnv(key, "");
    expect(getStripePaymentsReadiness()).toMatchObject({ status: "partial", checkoutConfigured: false });
  });
});
