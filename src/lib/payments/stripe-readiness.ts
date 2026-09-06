import { stripeWalletConfigurationIssues } from "./stripe-configuration";

export type StripePaymentsReadiness = {
  status: "ready" | "partial" | "disabled";
  checkoutConfigured: boolean;
  webhookConfigured: boolean;
  publishableKeyConfigured: boolean;
  blockingIssues: string[];
};

function hasConfiguredEnvValue(name: string) {
  const value = process.env[name]?.trim();
  return Boolean(value && value !== "undefined" && value !== "null" && !value.endsWith("_..."));
}

export function getStripePaymentsReadiness(): StripePaymentsReadiness {
  const paymentsEnabled =
    process.env.NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED?.trim() === "true";
  const checkoutCredentialConfigured = hasConfiguredEnvValue("STRIPE_SECRET_KEY");
  const webhookConfigured = hasConfiguredEnvValue("STRIPE_WEBHOOK_SECRET");
  const publishableKeyConfigured = hasConfiguredEnvValue("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

  if (!paymentsEnabled) {
    return {
      status: "disabled",
      checkoutConfigured: false,
      webhookConfigured,
      publishableKeyConfigured,
      blockingIssues: [],
    };
  }

  const configurationIssues = stripeWalletConfigurationIssues({
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    expectedAccountId: process.env.STRIPE_EXPECTED_ACCOUNT_ID,
  });
  const checkoutConfigured = checkoutCredentialConfigured && configurationIssues.length === 0;
  const anyConfigured = checkoutConfigured || webhookConfigured || publishableKeyConfigured;

  const blockingIssues: string[] = [...configurationIssues];
  if (anyConfigured && !checkoutCredentialConfigured) {
    blockingIssues.push("STRIPE_SECRET_KEY is missing, so wallet checkout cannot create sessions.");
  }
  if (anyConfigured && !webhookConfigured) {
    blockingIssues.push("STRIPE_WEBHOOK_SECRET is missing, so completed payments will not credit wallets.");
  }
  if (anyConfigured && !publishableKeyConfigured) {
    blockingIssues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing, so client payment UI may be unavailable.");
  }
  if (publishableKeyConfigured && !/^pk_live_[A-Za-z0-9]+$/.test(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "")) {
    blockingIssues.push("The publishable Stripe key must use live mode before wallet payments are enabled.");
  }

  return {
    status: blockingIssues.length > 0 ? "partial" : "ready",
    checkoutConfigured,
    webhookConfigured,
    publishableKeyConfigured,
    blockingIssues,
  };
}
