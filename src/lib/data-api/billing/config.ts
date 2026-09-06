import "server-only";
import { ApiError } from "@/lib/api-error";
import { getCanonicalOrigin } from "@/lib/constants/site";
import { stripeKeyMode } from "@/lib/payments/stripe-configuration";

export type PaidDataPlan = "pro" | "business";
export interface DataBillingConfig {
  secretKey: string;
  webhookSecret: string;
  accountId: string;
  livemode: boolean;
  origin: string;
  prices: Record<PaidDataPlan, string>;
  portalConfiguration: string;
}

export function dataBillingCheckoutEnabled() {
  return process.env.DATA_API_BILLING_ENABLED === "true";
}

export function getDataBillingConfig(): DataBillingConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = process.env.STRIPE_DATA_WEBHOOK_SECRET?.trim() ?? "";
  const accountId = process.env.STRIPE_EXPECTED_ACCOUNT_ID?.trim() ?? "";
  const mode = process.env.DATA_API_BILLING_MODE ?? "live";
  const prices = {
    pro: process.env.STRIPE_DATA_PRO_PRICE_ID?.trim() ?? "",
    business: process.env.STRIPE_DATA_BUSINESS_PRICE_ID?.trim() ?? "",
  };
  const portalConfiguration = process.env.STRIPE_DATA_PORTAL_CONFIGURATION_ID?.trim() ?? "";
  let origin: URL;
  try { origin = new URL(getCanonicalOrigin()); } catch { throw new ApiError(503, "Data billing is not configured"); }
  if (
    !["test", "live"].includes(mode) || stripeKeyMode(secretKey) !== mode ||
    (mode === "live" && !secretKey.startsWith("rk_live_")) ||
    !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret) || !/^acct_[A-Za-z0-9]+$/.test(accountId) ||
    !Object.values(prices).every((id) => /^price_[A-Za-z0-9]+$/.test(id)) || prices.pro === prices.business ||
    !/^bpc_[A-Za-z0-9]+$/.test(portalConfiguration) ||
    origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
    (origin.protocol !== "https:" && !(mode === "test" && ["localhost", "127.0.0.1"].includes(origin.hostname)))
  ) throw new ApiError(503, "Data billing is not configured");
  return { secretKey, webhookSecret, accountId, livemode: mode === "live", origin: origin.origin, prices, portalConfiguration };
}

export function dataBillingConfigured() {
  try { getDataBillingConfig(); return true; } catch { return false; }
}

export function safeStripeUrl(value: unknown, host: "checkout.stripe.com" | "billing.stripe.com") {
  try {
    if (typeof value !== "string") throw new Error();
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== host || url.port || url.username || url.password) throw new Error();
    return url.toString();
  } catch { throw new ApiError(502, "The billing provider returned an invalid redirect"); }
}
