import type {
  PaymentWebhookDeliveryStatus,
  TypedSupabaseClient,
} from "@/types/database";
import {
  getStripePaymentsReadiness,
  type StripePaymentsReadiness,
} from "./stripe-readiness";

const WEBHOOK_HEALTH_LOOKBACK_HOURS = 24;
const MISSING_RELATION_CODES = new Set(["42P01", "PGRST204", "PGRST205"]);

type StripeWebhookHealthRow = {
  delivery_status?: string | null;
  created_at?: string | null;
};

export type StripeWebhookDeliveryHealth = {
  status: "healthy" | "degraded" | "unknown";
  tableAvailable: boolean | null;
  recentFailures24h: number;
  recentSuccesses24h: number;
  consecutiveFailures: number;
  latestEventAt: string | null;
  latestProcessedAt: string | null;
  latestFailedAt: string | null;
  warning: string | null;
};

export type StripePaymentsHealth = StripePaymentsReadiness & {
  webhookDelivery: StripeWebhookDeliveryHealth;
};

export type StripeWebhookEventInput = {
  eventId?: string | null;
  eventType?: string | null;
  deliveryStatus: PaymentWebhookDeliveryStatus;
  walletId?: string | null;
  referenceId?: string | null;
  amount?: number | null;
  currency?: string | null;
  duplicate?: boolean;
  livemode?: boolean | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

function isMissingRelationError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;

  if (error.code && MISSING_RELATION_CODES.has(error.code)) {
    return true;
  }

  const message = error.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("not found");
}

function buildUnknownWebhookDeliveryHealth(args?: {
  tableAvailable?: boolean | null;
  warning?: string | null;
}): StripeWebhookDeliveryHealth {
  return {
    status: "unknown",
    tableAvailable: args?.tableAvailable ?? null,
    recentFailures24h: 0,
    recentSuccesses24h: 0,
    consecutiveFailures: 0,
    latestEventAt: null,
    latestProcessedAt: null,
    latestFailedAt: null,
    warning: args?.warning ?? null,
  };
}

export async function recordStripeWebhookEvent(
  supabase: TypedSupabaseClient,
  input: StripeWebhookEventInput
): Promise<void> {
  const { error } = await supabase.from("payment_webhook_events").insert({
    provider: "stripe",
    event_id: input.eventId ?? null,
    event_type: input.eventType ?? null,
    delivery_status: input.deliveryStatus,
    wallet_id: input.walletId ?? null,
    reference_id: input.referenceId ?? null,
    amount: input.amount ?? null,
    currency: input.currency ?? null,
    duplicate: input.duplicate ?? false,
    livemode: input.livemode ?? null,
    error_message: input.errorMessage ?? null,
    metadata: input.metadata ?? null,
  });

  if (!error || isMissingRelationError(error)) {
    return;
  }

  throw new Error(`Failed to record Stripe webhook event: ${error.message}`);
}

export async function getStripeWebhookDeliveryHealth(
  supabase: TypedSupabaseClient,
  readiness = getStripePaymentsReadiness()
): Promise<StripeWebhookDeliveryHealth> {
  if (!readiness.webhookConfigured) {
    return buildUnknownWebhookDeliveryHealth();
  }

  const lookback = new Date(
    Date.now() - WEBHOOK_HEALTH_LOOKBACK_HOURS * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from("payment_webhook_events")
    .select("delivery_status, created_at")
    .eq("provider", "stripe")
    .gte("created_at", lookback)
    .order("created_at", { ascending: false })
    .limit(50);

  if (isMissingRelationError(error)) {
    return buildUnknownWebhookDeliveryHealth({
      tableAvailable: false,
      warning:
        "payment_webhook_events table is unavailable, so Stripe delivery health is not being tracked yet.",
    });
  }

  if (error) {
    throw new Error(`Failed to fetch Stripe webhook delivery health: ${error.message}`);
  }

  const rows = ((data ?? []) as StripeWebhookHealthRow[]).filter(
    (row) => typeof row.created_at === "string"
  );
  if (rows.length === 0) {
    return buildUnknownWebhookDeliveryHealth({
      tableAvailable: true,
    });
  }

  const latestEventAt = rows[0]?.created_at ?? null;
  const latestProcessedAt =
    rows.find((row) => row.delivery_status === "processed")?.created_at ?? null;
  const latestFailedAt =
    rows.find((row) => row.delivery_status === "failed")?.created_at ?? null;
  const recentFailures24h = rows.filter((row) => row.delivery_status === "failed").length;
  const recentSuccesses24h = rows.filter((row) => row.delivery_status === "processed").length;

  let consecutiveFailures = 0;
  for (const row of rows) {
    if (row.delivery_status !== "failed") {
      break;
    }
    consecutiveFailures += 1;
  }

  const degraded =
    consecutiveFailures >= 3 ||
    (latestFailedAt !== null &&
      (latestProcessedAt === null || latestFailedAt > latestProcessedAt));

  return {
    status: degraded ? "degraded" : "healthy",
    tableAvailable: true,
    recentFailures24h,
    recentSuccesses24h,
    consecutiveFailures,
    latestEventAt,
    latestProcessedAt,
    latestFailedAt,
    warning: null,
  };
}

export async function getStripePaymentsHealth(
  supabase: TypedSupabaseClient
): Promise<StripePaymentsHealth> {
  const readiness = getStripePaymentsReadiness();
  const webhookDelivery = await getStripeWebhookDeliveryHealth(supabase, readiness);

  return {
    ...readiness,
    webhookDelivery,
  };
}
