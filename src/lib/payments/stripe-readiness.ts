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
  const checkoutConfigured = hasConfiguredEnvValue("STRIPE_SECRET_KEY");
  const webhookConfigured = hasConfiguredEnvValue("STRIPE_WEBHOOK_SECRET");
  const publishableKeyConfigured = hasConfiguredEnvValue("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const anyConfigured = checkoutConfigured || webhookConfigured || publishableKeyConfigured;

  const blockingIssues: string[] = [];
  if (anyConfigured && !checkoutConfigured) {
    blockingIssues.push("STRIPE_SECRET_KEY is missing, so wallet checkout cannot create sessions.");
  }
  if (anyConfigured && !webhookConfigured) {
    blockingIssues.push("STRIPE_WEBHOOK_SECRET is missing, so completed payments will not credit wallets.");
  }
  if (anyConfigured && !publishableKeyConfigured) {
    blockingIssues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing, so client payment UI may be unavailable.");
  }

  return {
    status: !anyConfigured ? "disabled" : blockingIssues.length > 0 ? "partial" : "ready",
    checkoutConfigured,
    webhookConfigured,
    publishableKeyConfigured,
    blockingIssues,
  };
}
