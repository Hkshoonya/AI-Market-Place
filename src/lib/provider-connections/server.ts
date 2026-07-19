import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderConnectionProvider } from "@/types/database";
import { decryptProviderSecret } from "./crypto";

const PUBLIC_CONNECTION_FIELDS =
  "id, provider, display_name, secret_hint, external_account_id, external_account_name, capabilities, status, last_validated_at, last_used_at, last_error, created_at, updated_at";

export interface PublicProviderConnection {
  id: string;
  provider: ProviderConnectionProvider;
  displayName: string;
  secretHint: string;
  externalAccountId: string | null;
  externalAccountName: string | null;
  capabilities: string[];
  status: "active" | "invalid" | "revoked";
  lastValidatedAt: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPublicProviderConnection(row: Record<string, unknown>): PublicProviderConnection {
  return {
    id: String(row.id),
    provider: row.provider as ProviderConnectionProvider,
    displayName: String(row.display_name),
    secretHint: String(row.secret_hint),
    externalAccountId:
      typeof row.external_account_id === "string" ? row.external_account_id : null,
    externalAccountName:
      typeof row.external_account_name === "string" ? row.external_account_name : null,
    capabilities: Array.isArray(row.capabilities)
      ? row.capabilities.filter((value): value is string => typeof value === "string")
      : [],
    status: row.status as PublicProviderConnection["status"],
    lastValidatedAt:
      typeof row.last_validated_at === "string" ? row.last_validated_at : null,
    lastUsedAt: typeof row.last_used_at === "string" ? row.last_used_at : null,
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listProviderConnections(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("provider_connections")
    .select(PUBLIC_CONNECTION_FIELDS)
    .eq("user_id", userId)
    .neq("status", "revoked")
    .order("provider");

  if (error) throw error;
  return (data ?? []).map((row) =>
    toPublicProviderConnection(row as unknown as Record<string, unknown>)
  );
}

export async function getProviderConnectionSecret(input: {
  connectionId: string;
  userId: string;
  expectedProvider?: ProviderConnectionProvider;
}) {
  const admin = createAdminClient();
  let query = admin
    .from("provider_connections")
    .select("id, provider, encrypted_secret, status")
    .eq("id", input.connectionId)
    .eq("user_id", input.userId)
    .eq("status", "active");

  if (input.expectedProvider) {
    query = query.eq("provider", input.expectedProvider);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Connected provider account is unavailable");

  const secret = decryptProviderSecret(data.encrypted_secret);
  await admin
    .from("provider_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id,
    provider: data.provider as ProviderConnectionProvider,
    secret,
  };
}
