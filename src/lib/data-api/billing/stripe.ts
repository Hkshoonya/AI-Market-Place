import "server-only";
import { ApiError } from "@/lib/api-error";
import type { DataBillingConfig } from "./config";

export type StripeObject = Record<string, unknown>;
export function record(value: unknown): StripeObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as StripeObject : {};
}
export function stripeId(value: unknown): string | null {
  return typeof value === "string" ? value : typeof record(value).id === "string" ? record(value).id as string : null;
}

export async function stripeRequest(
  config: DataBillingConfig, path: string, body?: URLSearchParams, idempotencyKey?: string
): Promise<StripeObject> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": "2026-02-25.clover",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  // Never propagate Stripe's raw error, which can contain keys or merchant data.
  if (!response.ok) throw new ApiError(502, "The billing provider could not complete this request");
  return record(await response.json());
}

export async function verifyBillingAccount(config: DataBillingConfig, requireCharges = false) {
  const account = await stripeRequest(config, "/account");
  if (account.id !== config.accountId || (requireCharges && account.charges_enabled !== true)) {
    throw new ApiError(503, "The billing merchant could not be verified");
  }
}

export function hasDataMetadata(object: StripeObject, userId?: string) {
  const metadata = record(object.metadata);
  return metadata.app === "aimarketcap" && metadata.purpose === "data_subscription" &&
    (!userId || metadata.user_id === userId);
}

export async function verifyDataCustomer(config: DataBillingConfig, customerId: string, userId: string) {
  const customer = await stripeRequest(config, `/customers/${encodeURIComponent(customerId)}`);
  if (customer.id !== customerId || customer.deleted || customer.livemode !== config.livemode || !hasDataMetadata(customer, userId)) {
    throw new ApiError(409, "The customer is not linked to this data account");
  }
}
