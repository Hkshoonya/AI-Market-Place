export function stripeKeyMode(key: string | undefined): "live" | "test" | null {
  const match = key?.trim().match(/^(?:sk|rk)_(live|test)_[A-Za-z0-9]+$/);
  return match ? (match[1] as "live" | "test") : null;
}

export function stripeWalletConfigurationIssues(config: {
  secretKey?: string;
  webhookSecret?: string;
  expectedAccountId?: string;
}) {
  const issues: string[] = [];
  if (stripeKeyMode(config.secretKey) !== "live") {
    issues.push("Wallet checkout requires a live Stripe server key; test payments cannot fund spendable wallets.");
  }
  if (!/^whsec_[A-Za-z0-9]+$/.test(config.webhookSecret?.trim() ?? "")) {
    issues.push("STRIPE_WEBHOOK_SECRET is missing or invalid, so completed payments cannot be verified.");
  }
  if (!/^acct_[A-Za-z0-9]+$/.test(config.expectedAccountId?.trim() ?? "")) {
    issues.push("STRIPE_EXPECTED_ACCOUNT_ID is missing, so the payment account cannot be verified.");
  }
  return issues;
}
