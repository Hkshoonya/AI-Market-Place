import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { env } from "@/lib/env";
import { getOrCreateWallet, creditWallet } from "@/lib/payments/wallet";
import { recordStripeWebhookEvent } from "@/lib/payments/stripe-health";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeMetadata = Record<string, string>;

type StripeEvent = {
  id: string;
  type: string;
  livemode?: boolean;
  data?: {
    object?: Record<string, unknown>;
  };
};

function parseStripeMetadata(value: unknown): StripeMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function parseStripeSignature(header: string | null) {
  if (!header) {
    throw new ApiError(400, "Missing Stripe signature");
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const chunk of header.split(",")) {
    const [scheme, value] = chunk.trim().split("=", 2);
    if (scheme === "t") {
      timestamp = Number.parseInt(value ?? "", 10);
    } else if (scheme === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestamp || !Number.isFinite(timestamp) || signatures.length === 0) {
    throw new ApiError(400, "Invalid Stripe signature");
  }

  return { timestamp, signatures };
}

function isSecureHexMatch(expected: string, actual: string) {
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(header);
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);

  if (ageSeconds > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    throw new ApiError(400, "Stripe signature has expired");
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const matched = signatures.some((signature) => isSecureHexMatch(expected, signature));

  if (!matched) {
    throw new ApiError(400, "Stripe signature verification failed");
  }
}

async function resolveWalletId(metadata: StripeMetadata) {
  if (metadata.wallet_id) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("wallets")
      .select("id")
      .eq("id", metadata.wallet_id)
      .single();

    if (!error && data) {
      return String(data.id);
    }
  }

  if (metadata.owner_id) {
    const wallet = await getOrCreateWallet(
      metadata.owner_id,
      metadata.owner_type === "agent" ? "agent" : "user"
    );
    return wallet.id;
  }

  throw new ApiError(400, "Stripe webhook metadata is missing wallet target");
}

function extractStripeObjectId(value: unknown) {
  if (typeof value === "string" && value) {
    return value;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id) {
      return id;
    }
  }

  return null;
}

function normalizeCurrency(currency: unknown) {
  return typeof currency === "string" ? currency.toLowerCase() : "";
}

function getCheckoutFundingDetails(object: Record<string, unknown>) {
  const paymentStatus = typeof object.payment_status === "string" ? object.payment_status : null;
  if (paymentStatus !== "paid") return null;

  const amountTotal = typeof object.amount_total === "number" ? object.amount_total : null;
  const currency = normalizeCurrency(object.currency);
  const metadata = parseStripeMetadata(object.metadata);
  const paymentIntentId =
    extractStripeObjectId(object.payment_intent) ?? extractStripeObjectId(object.id);

  if (!paymentIntentId || amountTotal === null) {
    throw new ApiError(400, "Stripe checkout session is missing payment details");
  }

  return {
    amount: amountTotal / 100,
    currency,
    metadata,
    txHash: `stripe:${paymentIntentId}`,
    description: "Stripe wallet top-up",
    referenceId: paymentIntentId,
  };
}

function getPaymentIntentFundingDetails(object: Record<string, unknown>) {
  const status = typeof object.status === "string" ? object.status : null;
  if (status !== "succeeded") return null;

  const amountReceived = typeof object.amount_received === "number" ? object.amount_received : null;
  const currency = normalizeCurrency(object.currency);
  const metadata = parseStripeMetadata(object.metadata);
  const paymentIntentId = typeof object.id === "string" ? object.id : null;

  if (!paymentIntentId || amountReceived === null) {
    throw new ApiError(400, "Stripe payment intent is missing payment details");
  }

  return {
    amount: amountReceived / 100,
    currency,
    metadata,
    txHash: `stripe:${paymentIntentId}`,
    description: "Stripe wallet top-up",
    referenceId: paymentIntentId,
  };
}

function isDuplicateWalletCreditError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("idx_wallet_tx_unique_hash") ||
    message.includes("duplicate key value violates unique constraint")
  );
}

function tryParseStripeEvent(payload: string): StripeEvent | null {
  try {
    const parsed = JSON.parse(payload) as StripeEvent;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildStripeWebhookAuditRecord(event: StripeEvent | null) {
  const object =
    event?.data?.object && typeof event.data.object === "object" && !Array.isArray(event.data.object)
      ? event.data.object
      : null;
  const metadata = parseStripeMetadata(object?.metadata);
  const amountMinorUnits =
    typeof object?.amount_total === "number"
      ? object.amount_total
      : typeof object?.amount_received === "number"
        ? object.amount_received
        : typeof object?.amount === "number"
          ? object.amount
          : null;

  return {
    eventId: event?.id ?? null,
    eventType: event?.type ?? null,
    walletId: metadata.wallet_id ?? null,
    referenceId:
      extractStripeObjectId(object?.payment_intent) ?? extractStripeObjectId(object?.id),
    amount: amountMinorUnits === null ? null : amountMinorUnits / 100,
    currency: normalizeCurrency(object?.currency) || null,
    livemode:
      typeof event?.livemode === "boolean"
        ? event.livemode
        : typeof object?.livemode === "boolean"
          ? object.livemode
          : null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

async function handleFundingEvent(object: Record<string, unknown>, type: string) {
  const details =
    type === "checkout.session.completed"
      ? getCheckoutFundingDetails(object)
      : type === "payment_intent.succeeded"
        ? getPaymentIntentFundingDetails(object)
        : null;

  if (!details) {
    return { processed: false, ignored: true };
  }

  if (!["usd", "usdc"].includes(details.currency)) {
    throw new ApiError(400, `Unsupported Stripe currency: ${details.currency || "unknown"}`);
  }

  const walletId = await resolveWalletId(details.metadata);

  try {
    await creditWallet(walletId, details.amount, "deposit", {
      chain: "internal",
      txHash: details.txHash,
      token: "USDC",
      referenceType: "stripe_payment",
      referenceId: details.referenceId,
      description: details.description,
    });

    return { processed: true, duplicate: false, walletId, amount: details.amount };
  } catch (error) {
    if (isDuplicateWalletCreditError(error)) {
      return { processed: true, duplicate: true, walletId, amount: details.amount };
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  let parsedEvent: StripeEvent | null = null;

  try {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new ApiError(500, "Stripe webhook is not configured");
    }

    const payload = await request.text();
    parsedEvent = tryParseStripeEvent(payload);
    verifyStripeSignature(
      payload,
      request.headers.get("stripe-signature"),
      env.STRIPE_WEBHOOK_SECRET
    );

    const event = parsedEvent;
    if (!event) {
      throw new ApiError(400, "Invalid Stripe event payload");
    }
    const object = event?.data?.object;
    if (!object || typeof object !== "object" || Array.isArray(object)) {
      throw new ApiError(400, "Invalid Stripe event payload");
    }

    const result = await handleFundingEvent(object, event.type);
    const admin = createAdminClient();
    const auditRecord = buildStripeWebhookAuditRecord(event);
    await recordStripeWebhookEvent(admin, {
      ...auditRecord,
      deliveryStatus: result.ignored ? "ignored" : "processed",
      duplicate: result.duplicate ?? false,
      walletId: result.walletId ?? auditRecord.walletId,
      amount: result.amount ?? auditRecord.amount,
    }).catch(() => {});

    return NextResponse.json({
      received: true,
      type: event.type,
      ...result,
    });
  } catch (error) {
    const admin = createAdminClient();
    const auditRecord = buildStripeWebhookAuditRecord(parsedEvent);
    await recordStripeWebhookEvent(admin, {
      ...auditRecord,
      deliveryStatus: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(() => {});

    return handleApiError(error, "api/webhooks/stripe");
  }
}
