import "server-only";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDataBillingConfig } from "./config";
import { withBillingLease } from "./store";
import { reconcileSubscription } from "./subscriptions";
import { verifyBillingAccount } from "./stripe";

export async function reconcileDataBilling() {
  if (process.env.DATA_API_BILLING_RECONCILE_ENABLED !== "true") return { disabled: true };
  const config = getDataBillingConfig();
  await verifyBillingAccount(config);
  const { data, error } = await createAdminClient().from("data_api_billing_customers")
    .select("user_id").not("customer_id", "is", null)
    .lt("last_checked_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .order("last_checked_at").order("user_id").limit(10);
  if (error) throw new ApiError(503, "Billing reconciliation lookup failed");
  const deadline = Date.now() + 60_000;
  let checked = 0;
  let failed = 0;
  for (const customer of data ?? []) {
    if (Date.now() > deadline) break;
    try {
      await withBillingLease(config, customer.user_id, (lease) => reconcileSubscription(config, lease));
      checked++;
    } catch { failed++; }
  }
  if (failed) throw new ApiError(503, `Billing reconciliation needs retry (${failed} failed, ${checked} checked)`);
  return { checked, failed };
}
