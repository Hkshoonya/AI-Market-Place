import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStripeUrl, type DataBillingConfig, type PaidDataPlan } from "./config";
import { saveBillingLease, withBillingLease } from "./store";
import { hasDataMetadata, record, stripeId, stripeRequest, verifyBillingAccount, verifyDataCustomer } from "./stripe";
import { reconcileSubscription } from "./subscriptions";

export async function createDataCheckout(config: DataBillingConfig, user: { id: string }, planSlug: PaidDataPlan) {
  await verifyBillingAccount(config, true);
  return withBillingLease(config, user.id, async (lease) => {
    const admin = createAdminClient();
    const { data: grant, error: grantError } = await admin.from("data_api_subscriptions")
      .select("source, status, current_period_end").eq("user_id", user.id).maybeSingle();
    if (grantError) throw new ApiError(503, "Data access could not be checked");
    if (lease.access_hold || (grant && grant.source !== "stripe" && ["active", "trialing"].includes(grant.status) &&
      (!grant.current_period_end || Date.parse(grant.current_period_end) > Date.now()))) {
      throw new ApiError(409, "Contact support before replacing your current data access");
    }
    const { data: plan, error: planError } = await admin.from("data_api_plans")
      .select("monthly_price_cents, checkout_enabled, is_active, is_public").eq("slug", planSlug).single();
    if (planError || !plan?.is_active || !plan.is_public || !plan.checkout_enabled) throw new ApiError(503, "This plan is not available for checkout");
    const price = await stripeRequest(config, `/prices/${encodeURIComponent(config.prices[planSlug])}?expand[]=product`);
    const recurring = record(price.recurring);
    if (price.id !== config.prices[planSlug] || price.active !== true || price.livemode !== config.livemode ||
      price.currency !== "usd" || price.unit_amount !== plan.monthly_price_cents || !Number.isSafeInteger(price.unit_amount) ||
      Number(price.unit_amount) <= 0 || price.type !== "recurring" || price.billing_scheme !== "per_unit" ||
      recurring.interval !== "month" || recurring.interval_count !== 1 || recurring.usage_type !== "licensed" ||
      !hasDataMetadata(record(price.product)) || record(price.product).active !== true) {
      throw new ApiError(503, "The configured price does not match the published data plan");
    }
    if (!lease.customer_id) {
      const customer = await stripeRequest(config, "/customers", new URLSearchParams({
        "metadata[app]": "aimarketcap", "metadata[purpose]": "data_subscription", "metadata[user_id]": user.id,
      }), `aimc-data-customer:${lease.customer_request_id}`);
      if (!/^cus_[A-Za-z0-9]+$/.test(String(customer.id)) || customer.livemode !== config.livemode || !hasDataMetadata(customer, user.id)) {
        throw new ApiError(502, "Could not create a linked billing customer");
      }
      await saveBillingLease(lease, { customer_id: String(customer.id) });
    }
    await verifyDataCustomer(config, lease.customer_id!, user.id);
    const subscription = await reconcileSubscription(config, lease);
    if (subscription && !["canceled", "incomplete_expired"].includes(String(subscription.status))) {
      throw new ApiError(409, "You already have a subscription. Manage billing instead of buying again.");
    }
    if (lease.checkout_session_id) {
      const current = await stripeRequest(config, `/checkout/sessions/${encodeURIComponent(lease.checkout_session_id)}`);
      if (current.status === "open") {
        if (lease.checkout_plan_slug !== planSlug) throw new ApiError(409, "Finish or wait for your existing checkout to expire before choosing another plan");
        return safeStripeUrl(current.url, "checkout.stripe.com");
      }
      if (current.status !== "expired" && current.status !== "complete") throw new ApiError(409, "Your earlier checkout needs reconciliation");
      await saveBillingLease(lease, { checkout_attempt_id: null, checkout_attempt_at: null, checkout_session_id: null });
    }
    if (lease.checkout_attempt_id) {
      // Stripe may prune idempotency keys after 24h. Never blindly retry an
      // unknown older result and create another payable checkout.
      if (lease.checkout_plan_slug !== planSlug || !lease.checkout_attempt_at ||
        Date.now() - Date.parse(lease.checkout_attempt_at) > 23 * 60 * 60 * 1000) {
        throw new ApiError(409, "An earlier checkout needs support reconciliation");
      }
    } else {
      await saveBillingLease(lease, { checkout_attempt_id: randomUUID(), checkout_attempt_at: new Date().toISOString(), checkout_plan_slug: planSlug });
    }
    const params = new URLSearchParams({
      mode: "subscription", customer: lease.customer_id!, "line_items[0][price]": config.prices[planSlug],
      "line_items[0][quantity]": "1", "payment_method_types[0]": "card",
      success_url: `${config.origin}/settings/billing?checkout=returned`, cancel_url: `${config.origin}/settings/billing?checkout=cancelled`,
      expires_at: String(Math.floor(Date.parse(lease.checkout_attempt_at!) / 1000) + 3600),
      client_reference_id: user.id,
    });
    for (const prefix of ["metadata", "subscription_data[metadata]"]) {
      params.set(`${prefix}[app]`, "aimarketcap"); params.set(`${prefix}[purpose]`, "data_subscription");
      params.set(`${prefix}[user_id]`, user.id); params.set(`${prefix}[plan_slug]`, planSlug);
      params.set(`${prefix}[checkout_attempt_id]`, lease.checkout_attempt_id!);
    }
    const session = await stripeRequest(config, "/checkout/sessions", params, `aimc-data-checkout:${lease.checkout_attempt_id}`);
    if (!/^cs_[A-Za-z0-9_]+$/.test(String(session.id)) || session.livemode !== config.livemode ||
      session.mode !== "subscription" || stripeId(session.customer) !== lease.customer_id || !hasDataMetadata(session, user.id)) {
      throw new ApiError(502, "The billing provider returned an invalid checkout");
    }
    await saveBillingLease(lease, { checkout_session_id: String(session.id) });
    if (session.status !== "open") throw new ApiError(409, "Your checkout has ended. Reload billing before trying again.");
    return safeStripeUrl(session.url, "checkout.stripe.com");
  });
}

export async function createDataPortal(config: DataBillingConfig, userId: string) {
  await verifyBillingAccount(config);
  return withBillingLease(config, userId, async (lease) => {
    if (!lease.customer_id) throw new ApiError(409, "No data billing account exists yet");
    await verifyDataCustomer(config, lease.customer_id, userId);
    const portal = await stripeRequest(config, `/billing_portal/configurations/${encodeURIComponent(config.portalConfiguration)}`);
    const features = record(portal.features);
    if (portal.id !== config.portalConfiguration || portal.active !== true || portal.is_default !== false || portal.livemode !== config.livemode ||
      !hasDataMetadata(portal) || record(features.subscription_cancel).enabled !== true ||
      record(features.subscription_cancel).mode !== "at_period_end" || record(features.subscription_update).enabled !== false ||
      record(features.invoice_history).enabled !== true || record(features.payment_method_update).enabled !== true) {
      throw new ApiError(503, "The dedicated billing portal is not configured correctly");
    }
    const session = await stripeRequest(config, "/billing_portal/sessions", new URLSearchParams({
      customer: lease.customer_id, configuration: config.portalConfiguration, return_url: `${config.origin}/settings/billing`,
    }));
    return safeStripeUrl(session.url, "billing.stripe.com");
  });
}
