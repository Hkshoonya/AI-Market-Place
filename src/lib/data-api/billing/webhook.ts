import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DataBillingConfig } from "./config";
import { saveBillingLease, withBillingLease } from "./store";
import { applySubscription, retrieveDataSubscription } from "./subscriptions";
import { hasDataMetadata, record, stripeId, stripeRequest, verifyBillingAccount } from "./stripe";

const MAX_BYTES = 1_000_000;
const EVENT_TYPES = new Set([
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
  "customer.subscription.paused", "customer.subscription.resumed", "invoice.paid", "invoice.payment_failed",
  "charge.refunded", "charge.dispute.created",
]);

export async function readDataBillingEvent(request: Request, secret: string) {
  const header = request.headers.get("stripe-signature") ?? "";
  const timestamps = header.split(",").filter((part) => part.trim().startsWith("t=")).map((part) => part.trim().slice(2));
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0])) throw new ApiError(400, "Invalid webhook signature");
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) throw new ApiError(400, "Expired webhook signature");
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new ApiError(413, "Webhook payload is too large");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing webhook payload");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        void reader.cancel().catch(() => {});
        throw new ApiError(413, "Webhook payload is too large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks, length);
  const expected = createHmac("sha256", secret).update(`${timestamps[0]}.`).update(raw).digest();
  const valid = header.split(",").some((part) => {
    const match = /^v1=([a-fA-F0-9]{64})$/.exec(part.trim());
    return !!match && timingSafeEqual(expected, Buffer.from(match[1], "hex"));
  });
  if (!valid) throw new ApiError(400, "Invalid webhook signature");
  try {
    const event = record(JSON.parse(raw.toString("utf8")));
    if (!/^evt_[A-Za-z0-9_]+$/.test(String(event.id)) || typeof event.type !== "string" || typeof event.livemode !== "boolean") throw new Error();
    return event;
  } catch { throw new ApiError(400, "Invalid webhook payload"); }
}

export async function processDataBillingEvent(config: DataBillingConfig, event: Awaited<ReturnType<typeof readDataBillingEvent>>) {
  if (event.livemode !== config.livemode || !EVENT_TYPES.has(String(event.type))) return { ignored: true };
  if (event.account && event.account !== config.accountId) return { ignored: true };
  let object = record(record(event.data).object);
  if (object.livemode !== config.livemode) return { ignored: true };
  const type = String(event.type);
  const isSubscription = type.startsWith("customer.subscription.");
  if (isSubscription && !hasDataMetadata(object)) return { ignored: true };
  await verifyBillingAccount(config);

  const hold = type === "charge.refunded" || type === "charge.dispute.created";
  if (type === "charge.dispute.created") {
    const chargeId = stripeId(object.charge);
    if (!chargeId || !/^ch_[A-Za-z0-9]+$/.test(chargeId)) return { ignored: true };
    object = await stripeRequest(config, `/charges/${encodeURIComponent(chargeId)}`);
  }
  const customerId = stripeId(object.customer);
  if (!customerId || !/^cus_[A-Za-z0-9]+$/.test(customerId)) return { ignored: true };
  const admin = createAdminClient();
  const { data: customer, error } = await admin.from("data_api_billing_customers").select("user_id")
    .eq("customer_id", customerId).maybeSingle();
  if (error) throw new ApiError(503, "Billing lookup failed");
  if (!customer) return { ignored: true };
  if (hold) {
    let invoiceId = stripeId(object.invoice);
    if (!invoiceId) {
      const paymentIntent = stripeId(object.payment_intent);
      if (!paymentIntent || !/^pi_[A-Za-z0-9]+$/.test(paymentIntent)) return { ignored: true };
      const query = new URLSearchParams({ "payment[type]": "payment_intent", "payment[payment_intent]": paymentIntent, limit: "2" });
      const payments = await stripeRequest(config, `/invoice_payments?${query}`);
      if (!Array.isArray(payments.data) || payments.has_more || payments.data.length > 1) throw new ApiError(503, "Invoice payment needs reconciliation");
      invoiceId = stripeId(record(payments.data[0]).invoice);
    }
    if (!invoiceId || !/^in_[A-Za-z0-9]+$/.test(invoiceId)) return { ignored: true };
    object = await stripeRequest(config, `/invoices/${encodeURIComponent(invoiceId)}`);
    if (stripeId(object.customer) !== customerId || object.livemode !== config.livemode) return { ignored: true };
  }
  const subscriptionId = isSubscription ? stripeId(object) :
    stripeId(record(record(object.parent).subscription_details).subscription) ?? stripeId(object.subscription);
  if (!subscriptionId || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) return { ignored: true };

  return withBillingLease(config, customer.user_id, async (lease) => {
    const current = await retrieveDataSubscription(config, subscriptionId);
    if (!hasDataMetadata(current, lease.user_id) || stripeId(current.customer) !== lease.customer_id || current.livemode !== config.livemode) return { ignored: true };
    // Pin a new subscription to the exact Checkout attempt created by this app.
    // Old canceled subscriptions must not overwrite a user's later purchase.
    if (lease.subscription_id !== subscriptionId &&
      (!lease.checkout_attempt_id || record(current.metadata).checkout_attempt_id !== lease.checkout_attempt_id)) return { ignored: true };
    if (hold) await saveBillingLease(lease, { access_hold: true });
    await applySubscription(config, lease, current, { id: String(event.id), type });
    return { processed: true };
  });
}
