import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { ApiError, handleApiError } from "@/lib/api-error";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWallet } from "@/lib/payments/wallet";
import { WALLET_TOP_UP_PACKS } from "@/lib/constants/wallet";
import { buildCanonicalUrl } from "@/lib/constants/site";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  pack: z.enum(["starter", "builder", "growth", "scale"]),
  return_path: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || (value.startsWith("/") && !value.startsWith("//")), {
      message: "return_path must be a local path",
    }),
});

function buildStripeCheckoutPayload(args: {
  amount: number;
  packLabel: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  walletId: string;
  ownerId: string;
  packSlug: string;
}) {
  const params = new URLSearchParams();

  params.set("mode", "payment");
  params.append("payment_method_types[]", "card");
  params.set("success_url", args.successUrl);
  params.set("cancel_url", args.cancelUrl);
  params.set("client_reference_id", args.ownerId);
  params.set("metadata[wallet_id]", args.walletId);
  params.set("metadata[owner_id]", args.ownerId);
  params.set("metadata[owner_type]", "user");
  params.set("metadata[pack_slug]", args.packSlug);
  params.set("payment_intent_data[metadata][wallet_id]", args.walletId);
  params.set("payment_intent_data[metadata][owner_id]", args.ownerId);
  params.set("payment_intent_data[metadata][owner_type]", "user");
  params.set("payment_intent_data[metadata][pack_slug]", args.packSlug);
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(args.amount * 100));
  params.set("line_items[0][price_data][product_data][name]", args.packLabel);
  params.set("line_items[0][price_data][product_data][description]", args.description);
  params.set("line_items[0][quantity]", "1");

  return params;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`wallet-checkout:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    if (!env.STRIPE_SECRET_KEY) {
      throw new ApiError(503, "Stripe checkout is not configured");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const pack = WALLET_TOP_UP_PACKS.find((item) => item.slug === parsed.data.pack);
    if (!pack) {
      throw new ApiError(400, "Unknown wallet top-up pack");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    const wallet = await getOrCreateWallet(user.id);
    const returnPath = parsed.data.return_path || "/wallet";
    const separator = returnPath.includes("?") ? "&" : "?";
    const successUrl = buildCanonicalUrl(`${returnPath}${separator}stripe=success&pack=${pack.slug}`);
    const cancelUrl = buildCanonicalUrl(`${returnPath}${separator}stripe=cancelled&pack=${pack.slug}`);
    const payload = buildStripeCheckoutPayload({
      amount: pack.amount,
      packLabel: pack.label,
      description: pack.description,
      successUrl,
      cancelUrl,
      walletId: wallet.id,
      ownerId: user.id,
      packSlug: pack.slug,
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    const stripeBody = (await stripeResponse.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!stripeResponse.ok || !stripeBody.url || !stripeBody.id) {
      throw new ApiError(
        502,
        stripeBody.error?.message || "Failed to create Stripe checkout session"
      );
    }

    return NextResponse.json({
      session_id: stripeBody.id,
      url: stripeBody.url,
      pack: {
        slug: pack.slug,
        label: pack.label,
        amount: pack.amount,
      },
    });
  } catch (error) {
    return handleApiError(error, "api/marketplace/wallet/checkout");
  }
}
