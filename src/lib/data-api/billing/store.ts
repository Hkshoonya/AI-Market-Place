import "server-only";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DataApiBillingCustomer } from "@/types/database";
import type { DataBillingConfig } from "./config";

export type BillingLease = DataApiBillingCustomer & { lease_token: string };

export async function withBillingLease<T>(config: DataBillingConfig, userId: string, fn: (lease: BillingLease) => Promise<T>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_data_api_billing", {
    p_user_id: userId, p_account_id: config.accountId, p_livemode: config.livemode,
  });
  if (error) throw new ApiError(503, "Data billing storage is unavailable or not configured");
  const lease = data?.[0];
  if (!lease?.lease_token) throw new ApiError(409, "A billing update is already in progress. Please retry shortly.");
  try { return await fn(lease as BillingLease); }
  finally {
    await admin.rpc("release_data_api_billing", { p_user_id: userId, p_token: lease.lease_token });
  }
}

export async function saveBillingLease(lease: BillingLease, patch: Partial<DataApiBillingCustomer>) {
  const { data, error } = await createAdminClient().rpc("save_data_api_billing", {
    p_user_id: lease.user_id, p_token: lease.lease_token, p_patch: patch,
  });
  if (error || !data?.[0]) throw new ApiError(409, "Billing changed during this request. Please retry shortly.");
  Object.assign(lease, data[0]);
}
