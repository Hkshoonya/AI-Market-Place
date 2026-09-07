import "server-only";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DataBillingConfig, PaidDataPlan } from "./config";
import type { BillingLease } from "./store";
import { hasDataMetadata, record, stripeId, stripeRequest, type StripeObject } from "./stripe";

export function subscriptionSnapshot(config: DataBillingConfig, lease: BillingLease, subscription: StripeObject) {
  if (!hasDataMetadata(subscription, lease.user_id) || subscription.livemode !== config.livemode ||
    stripeId(subscription.customer) !== lease.customer_id || !/^sub_[A-Za-z0-9]+$/.test(String(subscription.id))) {
    throw new ApiError(409, "The subscription is not linked to this data account");
  }
  const items = record(subscription.items);
  const item = record(Array.isArray(items.data) ? items.data[0] : null);
  const price = record(item.price);
  const plan = (Object.entries(config.prices) as [PaidDataPlan, string][]).find(([, id]) => id === price.id)?.[0];
  const fallback = lease.checkout_plan_slug;
  if (!plan && fallback !== "pro" && fallback !== "business") throw new ApiError(409, "Unrecognized data subscription price");
  const start = item.current_period_start ?? subscription.current_period_start;
  const end = item.current_period_end ?? subscription.current_period_end;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || Number(start) <= 0 || Number(end) <= Number(start) || Number(end) > 253402300799) {
    throw new ApiError(502, "Invalid subscription period");
  }
  const invoice = record(subscription.latest_invoice);
  const recurring = record(price.recurring);
  const valid = plan && Array.isArray(items.data) && items.data.length === 1 && !items.has_more &&
    item.quantity === 1 && price.currency === "usd" && recurring.interval === "month" &&
    recurring.interval_count === 1 && !subscription.pause_collection;
  // A Checkout redirect, trial or merely-created subscription never grants paid access.
  const paid = invoice.status === "paid" && stripeId(invoice.customer) === lease.customer_id &&
    invoice.livemode === config.livemode;
  const status = valid && paid && subscription.status === "active" ? "active" :
    subscription.status === "canceled" ? "canceled" :
    subscription.status === "past_due" || subscription.status === "unpaid" ? "past_due" : "expired";
  return {
    subscriptionId: String(subscription.id), plan: plan ?? fallback as PaidDataPlan, status,
    start: new Date(Number(start) * 1000).toISOString(), end: new Date(Number(end) * 1000).toISOString(),
  };
}

export async function retrieveDataSubscription(config: DataBillingConfig, id: string) {
  if (!/^sub_[A-Za-z0-9]+$/.test(id)) throw new ApiError(400, "Invalid subscription reference");
  return stripeRequest(config, `/subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`);
}

export async function applySubscription(config: DataBillingConfig, lease: BillingLease, subscription: StripeObject,
  event?: { id: string; type: string }) {
  const snapshot = subscriptionSnapshot(config, lease, subscription);
  const { error } = await createAdminClient().rpc("apply_data_api_billing", {
    p_user_id: lease.user_id, p_token: lease.lease_token, p_subscription_id: snapshot.subscriptionId,
    p_plan_slug: snapshot.plan, p_status: snapshot.status, p_period_start: snapshot.start, p_period_end: snapshot.end,
    ...(event ? { p_event_id: event.id, p_event_type: event.type } : {}),
  });
  if (error) throw new ApiError(503, "Subscription reconciliation could not be saved");
  lease.subscription_id = snapshot.subscriptionId;
  return snapshot;
}

export async function reconcileSubscription(config: DataBillingConfig, lease: BillingLease, event?: { id: string; type: string }) {
  let id = lease.subscription_id;
  if (lease.checkout_session_id) {
    const session = await stripeRequest(config, `/checkout/sessions/${encodeURIComponent(lease.checkout_session_id)}`);
    if (!hasDataMetadata(session, lease.user_id) || stripeId(session.customer) !== lease.customer_id || session.livemode !== config.livemode) {
      throw new ApiError(409, "The checkout is not linked to this data account");
    }
    if (session.status === "complete") id = stripeId(session.subscription) ?? id;
  }
  if (!id) return null;
  const subscription = await retrieveDataSubscription(config, id);
  await applySubscription(config, lease, subscription, event);
  return subscription;
}
