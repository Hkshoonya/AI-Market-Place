import type { TypedSupabaseClient } from "@/types/database";

export type MarketplacePolicyDecision = "allow" | "review" | "block";

export interface ListingPolicySignal {
  field: string;
  pattern: string;
  value: string;
}

export interface ListingPolicyEvaluation {
  decision: MarketplacePolicyDecision;
  label: "allow" | "illegal_goods" | "suspicious_capability";
  confidence: number;
  reasons: string[];
  matchedSignals: ListingPolicySignal[];
}

export interface ListingPolicyInput {
  title: string;
  description: string;
  shortDescription?: string | null;
  listingType: string;
  tags?: string[] | null;
  agentConfig?: Record<string, unknown> | null;
  mcpManifest?: Record<string, unknown> | null;
}

export const DEFAULT_AUTONOMOUS_COMMERCE_POLICY = {
  is_enabled: true,
  max_order_amount: 100,
  daily_spend_limit: 250,
  allowed_listing_types: [
    "api_access",
    "model_weights",
    "fine_tuned_model",
    "dataset",
    "prompt_template",
    "agent",
    "mcp_server",
  ],
  require_verified_sellers: true,
  block_flagged_listings: true,
} as const;

interface AutonomousPurchaseInput {
  buyerId: string;
  authMethod: "session" | "api_key";
  listing: {
    id: string;
    seller_id: string;
    listing_type: string;
    price: number | string | null;
  };
}

interface AutonomousGuardrailResult {
  allowed: boolean;
  httpStatus?: number;
  code?: string;
  error?: string;
}

const BLOCK_RULES = [
  {
    reason: "Matched stolen credential marketplace language.",
    patterns: [
      /\bstolen credentials?\b/i,
      /\bcracked accounts?\b/i,
      /\bcombo list\b/i,
      /\bstealer logs?\b/i,
      /\bphishing (kit|panel|page|pages)\b/i,
    ],
  },
  {
    reason: "Matched malware or exploit-kit sale language.",
    patterns: [
      /\bransomware\b/i,
      /\binfostealer\b/i,
      /\bkeylogger\b/i,
      /\btoken grabber\b/i,
      /\bremote access trojan\b/i,
      /\bexploit kit\b/i,
      /\bcredential stealer\b/i,
      /\bbotnet\b/i,
    ],
  },
];

const REVIEW_RULES = [
  {
    reason: "Matched suspicious exploit or bypass language.",
    patterns: [
      /\bcredential bypass\b/i,
      /\botp bypass\b/i,
      /\bcaptcha bypass\b/i,
      /\bpayload\b/i,
      /\bexploit workflow\b/i,
      /\baccount generator\b/i,
      /\bchecker combo\b/i,
    ],
  },
  {
    reason: "Matched suspicious manifest or automation language.",
    patterns: [
      /\bmass account\b/i,
      /\bflooder\b/i,
      /\bstealth proxy\b/i,
      /\bcredential stuffing\b/i,
      /\btoken farming\b/i,
    ],
  },
];

function buildFieldValues(input: ListingPolicyInput) {
  return [
    { field: "title", value: input.title },
    { field: "short_description", value: input.shortDescription ?? "" },
    { field: "description", value: input.description },
    { field: "tags", value: (input.tags ?? []).join(" ") },
    { field: "listing_type", value: input.listingType },
    { field: "agent_config", value: input.agentConfig ? JSON.stringify(input.agentConfig) : "" },
    { field: "mcp_manifest", value: input.mcpManifest ? JSON.stringify(input.mcpManifest) : "" },
  ];
}

export function evaluateListingPolicy(input: ListingPolicyInput): ListingPolicyEvaluation {
  const fields = buildFieldValues(input);
  const matchedSignals: ListingPolicySignal[] = [];
  const reasons: string[] = [];

  for (const rule of BLOCK_RULES) {
    for (const pattern of rule.patterns) {
      for (const field of fields) {
        const match = field.value.match(pattern);
        if (!match) continue;
        matchedSignals.push({
          field: field.field,
          pattern: pattern.source,
          value: match[0],
        });
        reasons.push(rule.reason);
      }
    }
  }

  if (matchedSignals.length > 0) {
    return {
      decision: "block",
      label: "illegal_goods",
      confidence: 0.98,
      reasons: [...new Set(reasons)],
      matchedSignals,
    };
  }

  const reviewSignals: ListingPolicySignal[] = [];
  const reviewReasons: string[] = [];

  for (const rule of REVIEW_RULES) {
    for (const pattern of rule.patterns) {
      for (const field of fields) {
        const match = field.value.match(pattern);
        if (!match) continue;
        reviewSignals.push({
          field: field.field,
          pattern: pattern.source,
          value: match[0],
        });
        reviewReasons.push(rule.reason);
      }
    }
  }

  if (reviewSignals.length > 0) {
    return {
      decision: "review",
      label: "suspicious_capability",
      confidence: reviewSignals.some((signal) => signal.field === "title" || signal.field === "tags")
        ? 0.8
        : 0.72,
      reasons: [...new Set(reviewReasons)],
      matchedSignals: reviewSignals,
    };
  }

  return {
    decision: "allow",
    label: "allow",
    confidence: 0.1,
    reasons: [],
    matchedSignals: [],
  };
}

function startOfUtcDayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function numericPrice(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

export async function enforceAutonomousCommerceGuardrails(
  supabase: TypedSupabaseClient,
  input: AutonomousPurchaseInput
): Promise<AutonomousGuardrailResult> {
  if (input.authMethod !== "api_key") {
    return { allowed: true };
  }

  const price = numericPrice(input.listing.price);

  const { data: policyRow, error: policyError } = await supabase
    .from("autonomous_commerce_policies")
    .select("*")
    .eq("owner_id", input.buyerId)
    .maybeSingle();

  if (policyError) {
    throw new Error(`Failed to load autonomous commerce policy: ${policyError.message}`);
  }

  const policy = {
    ...DEFAULT_AUTONOMOUS_COMMERCE_POLICY,
    ...(policyRow ?? {}),
  };

  if (!policy.is_enabled) {
    return {
      allowed: false,
      httpStatus: 403,
      code: "autonomous_commerce_disabled",
      error: "Autonomous marketplace purchases are disabled for this identity.",
    };
  }

  if (price > Number(policy.max_order_amount)) {
    return {
      allowed: false,
      httpStatus: 403,
      code: "max_order_amount_exceeded",
      error: `Autonomous purchase cap exceeded. Max allowed is $${Number(policy.max_order_amount).toFixed(2)}.`,
    };
  }

  if (!(policy.allowed_listing_types as readonly string[]).includes(input.listing.listing_type)) {
    return {
      allowed: false,
      httpStatus: 403,
      code: "listing_type_not_allowed",
      error: "This listing type is not enabled for autonomous purchases.",
    };
  }

  if (policy.require_verified_sellers) {
    const { data: sellerProfile, error: sellerError } = await supabase
      .from("profiles")
      .select("seller_verified")
      .eq("id", input.listing.seller_id)
      .single();

    if (sellerError) {
      throw new Error(`Failed to verify seller trust tier: ${sellerError.message}`);
    }

    if (!sellerProfile?.seller_verified) {
      return {
        allowed: false,
        httpStatus: 403,
        code: "seller_not_verified",
        error: "Autonomous purchases currently require a verified seller.",
      };
    }
  }

  if (policy.block_flagged_listings) {
    const { data: reviewRows, error: reviewError } = await supabase
      .from("listing_policy_reviews")
      .select("decision, review_status")
      .eq("listing_id", input.listing.id)
      .eq("review_status", "open")
      .order("created_at", { ascending: false })
      .limit(1);

    if (reviewError) {
      throw new Error(`Failed to load listing policy review: ${reviewError.message}`);
    }

    const activeReview = reviewRows?.[0];
    if (activeReview?.decision === "block") {
      return {
        allowed: false,
        httpStatus: 403,
        code: "listing_blocked_by_policy",
        error: "This listing is blocked by marketplace policy and cannot be purchased autonomously.",
      };
    }

    if (activeReview?.decision === "review") {
      return {
        allowed: false,
        httpStatus: 403,
        code: "listing_under_review",
        error: "This listing is under marketplace review and cannot be purchased autonomously yet.",
      };
    }
  }

  const { data: todayOrders, error: orderError } = await supabase
    .from("marketplace_orders")
    .select("price_at_time, status, message")
    .eq("buyer_id", input.buyerId)
    .eq("message", "Purchased via API")
    .gte("created_at", startOfUtcDayIso());

  if (orderError) {
    throw new Error(`Failed to load autonomous purchase history: ${orderError.message}`);
  }

  const dailySpend = (todayOrders ?? [])
    .filter((order) => order.status !== "cancelled" && order.status !== "rejected")
    .reduce((sum, order) => sum + numericPrice(order.price_at_time), 0);

  if (dailySpend + price > Number(policy.daily_spend_limit)) {
    return {
      allowed: false,
      httpStatus: 403,
      code: "daily_spend_limit_exceeded",
      error: `Autonomous daily spend limit exceeded. Limit is $${Number(policy.daily_spend_limit).toFixed(2)}.`,
    };
  }

  return { allowed: true };
}

export async function syncListingPolicyReview(
  supabase: TypedSupabaseClient,
  input: {
    listingId: string;
    sellerId: string;
    sourceAction: "create" | "update" | "manual_rescan";
    evaluation: ListingPolicyEvaluation;
    excerpt?: string | null;
  }
) {
  if (input.evaluation.decision === "allow") {
    const { error } = await supabase
      .from("listing_policy_reviews")
      .update({
        review_status: "dismissed",
        reviewed_at: new Date().toISOString(),
        resolution_notes: "Auto-cleared after safe rescan.",
      })
      .eq("listing_id", input.listingId)
      .eq("review_status", "open");

    if (error) {
      throw new Error(`Failed to clear listing policy reviews: ${error.message}`);
    }

    return;
  }

  const { error } = await supabase.from("listing_policy_reviews").insert({
    listing_id: input.listingId,
    seller_id: input.sellerId,
    source_action: input.sourceAction,
    decision: input.evaluation.decision,
    classifier_label: input.evaluation.label,
    classifier_confidence: input.evaluation.confidence,
    reasons: input.evaluation.reasons,
    matched_signals: input.evaluation.matchedSignals,
    excerpt: input.excerpt ?? null,
    review_status: "open",
  });

  if (error) {
    throw new Error(`Failed to record listing policy review: ${error.message}`);
  }
}
