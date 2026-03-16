import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { z } from "zod";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { enrichListingsWithProfiles } from "@/lib/marketplace/enrich-listings";
import {
  filterMarketplaceListings,
  paginateMarketplaceListings,
  sortMarketplaceListings,
} from "@/lib/marketplace/discovery";
import { evaluateListingPolicy, syncListingPolicyReview } from "@/lib/marketplace/policy";
import { buildListingPreviewManifest } from "@/lib/marketplace/manifest";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";
import { isRuntimeFlagEnabled } from "@/lib/runtime-flags";
import type { MarketplaceSortOption } from "@/lib/constants/marketplace";

const createListingSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(10000, "Description must be 10000 characters or less"),
  short_description: z
    .string()
    .max(500, "Short description must be 500 characters or less")
    .optional()
    .nullable(),
  listing_type: z.enum(
    [
      "api_access",
      "model_weights",
      "fine_tuned_model",
      "dataset",
      "prompt_template",
      "agent",
      "mcp_server",
    ],
    {
      message:
        "listing_type must be one of: api_access, model_weights, fine_tuned_model, dataset, prompt_template, agent, mcp_server",
    }
  ),
  pricing_type: z
    .enum([
      "free",
      "one_time",
      "monthly_subscription",
      "per_token",
      "per_request",
      "contact",
    ])
    .optional()
    .default("one_time"),
  price: z
    .number()
    .min(0, "Price must be non-negative")
    .optional()
    .nullable(),
  currency: z.string().max(10).optional().default("USD"),
  model_id: z
    .string()
    .uuid("model_id must be a valid UUID")
    .optional()
    .nullable(),
  tags: z
    .array(z.string().max(50))
    .max(20, "Maximum 20 tags allowed")
    .optional()
    .default([]),
  thumbnail_url: z
    .string()
    .url("thumbnail_url must be a valid URL")
    .optional()
    .nullable(),
  demo_url: z
    .string()
    .url("demo_url must be a valid URL")
    .optional()
    .nullable(),
  documentation_url: z
    .string()
    .url("documentation_url must be a valid URL")
    .optional()
    .nullable(),
  agent_config: z.record(z.string(), z.unknown()).optional().nullable(),
  mcp_manifest: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`listings:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const sort = (searchParams.get("sort") as MarketplaceSortOption) || "trust";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const search = searchParams.get("q");
  const pricingType = searchParams.get("pricing_type");
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  const autonomy = searchParams.get("autonomy");
  const contract = searchParams.get("contract");
  const sellerParam = searchParams.get("seller");
  const sellerMode =
    searchParams.get("seller_mode") ||
    (sellerParam === "agent" ? "agent" : null);
  const sellerId = sellerParam === "agent" ? null : sellerParam;

  let query = supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "active");

  if (type)
    query = query.eq("listing_type", type as import("@/types/database").ListingType);
  if (pricingType)
    query = query.eq(
      "pricing_type",
      pricingType as import("@/types/database").MarketplacePricingType
    );
  if (search) query = query.textSearch("fts", search);
  if (minPrice) query = query.gte("price", parseFloat(minPrice));
  if (maxPrice) query = query.lte("price", parseFloat(maxPrice));
  if (autonomy === "ready") query = query.eq("autonomy_mode", "autonomous_allowed");
  if (sellerId) query = query.eq("seller_id", sellerId);
  if (sellerMode === "agent") query = query.not("agent_id", "is", null);
  if (sellerMode === "human") query = query.is("agent_id", null);
  if (contract === "manifest") {
    query = query.or("preview_manifest.not.is.null,mcp_manifest.not.is.null,agent_config.not.is.null");
  }

  const { data, error } = await query;

  if (error) {
    void systemLog.error("api/marketplace/listings", "Query error", { error: JSON.stringify(error) });
    return NextResponse.json(
      {
        error:
          "Failed to fetch marketplace listings. Please try again later.",
      },
      { status: 500 }
    );
  }

  // Enrich with seller profiles (no FK constraint exists, so fetch separately)
  // enrichListingsWithProfiles accepts AnyClient internally
  const enriched = await enrichListingsWithProfiles(supabase, data || []);
  const filtered = filterMarketplaceListings(
    enriched as import("@/types/database").MarketplaceListingWithSeller[],
    {
      autonomy,
      contract,
      sellerId,
      sellerMode,
    }
  );
  const sorted = sortMarketplaceListings(filtered, sort);
  const paginated = paginateMarketplaceListings(sorted, page, limit);
  const total = sorted.length;

  return NextResponse.json({
    data: paginated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings");
  }
}

export async function POST(request: NextRequest) {
  try {
  const { createClient: createServerClient } = await import(
    "@/lib/supabase/server"
  );
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Authentication required. Please sign in to create a listing.",
      },
      { status: 401 }
    );
  }

  const rl = await rateLimit(`listing-create:${user.id}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = createListingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    title,
    description,
    short_description,
    listing_type,
    pricing_type,
    price,
    currency,
    model_id,
    tags,
    thumbnail_url,
    demo_url,
    documentation_url,
    agent_config,
    mcp_manifest,
  } = parsed.data;

  // Generate slug from title
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_seller, seller_verified")
    .eq("id", user.id)
    .single();

  const sellerVerified = Boolean(profile?.seller_verified);
  const enforceSellerVerification = isRuntimeFlagEnabled(
    "ENFORCE_SELLER_VERIFICATION"
  );
  const policyEvaluation = evaluateListingPolicy({
    title,
    description,
    shortDescription: short_description ?? null,
    listingType: listing_type,
    tags,
    agentConfig: agent_config ?? null,
    mcpManifest: mcp_manifest ?? null,
  });

  if (!sellerVerified && !enforceSellerVerification) {
    await systemLog.warn(
      "api/marketplace/listings",
      "Deprecated unverified seller publish path used",
      {
        userId: user.id,
        listingType: listing_type,
      }
    );
  }

  const initialStatus =
    sellerVerified || !enforceSellerVerification ? "active" : "draft";
  const publishStatus =
    policyEvaluation.decision === "allow" ? initialStatus : "draft";
  const previewManifest = buildListingPreviewManifest({
    id: `preview:${slug}`,
    slug,
    title,
    description,
    short_description: short_description ?? null,
    listing_type,
    pricing_type: pricing_type || "one_time",
    price: price ?? null,
    currency: currency || "USD",
    documentation_url: documentation_url || null,
    demo_url: demo_url || null,
    tags: tags || [],
    agent_config: agent_config ?? null,
    mcp_manifest: mcp_manifest ?? null,
    preview_manifest: null,
  });

  // Mark user as seller if not already
  await supabase
    .from("profiles")
    .update({ is_seller: true })
    .eq("id", user.id);

  const { data, error } = await supabase
    .from("marketplace_listings")
    .insert({
      seller_id: user.id,
      slug,
      title,
      description,
      short_description: short_description || null,
      listing_type,
      status: publishStatus,
      pricing_type: pricing_type || "one_time",
      price: price ?? null,
      currency: currency || "USD",
      model_id: model_id || null,
      tags: tags || [],
      thumbnail_url: thumbnail_url || null,
      demo_url: demo_url || null,
      documentation_url: documentation_url || null,
      preview_manifest: previewManifest,
      ...(listing_type === "agent" && agent_config ? { agent_config } : {}),
      ...(listing_type === "mcp_server" && mcp_manifest
        ? { mcp_manifest }
        : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Failed to create listing. Please check your input and try again.",
      },
      { status: 500 }
    );
  }

  await syncListingPolicyReview(supabase, {
    listingId: data.id,
    sellerId: user.id,
    sourceAction: "create",
    evaluation: policyEvaluation,
    excerpt: `${title}\n${description}`.slice(0, 280),
  });

  return NextResponse.json(
    {
      data,
      policy:
        policyEvaluation.decision === "allow"
          ? null
          : {
              decision: policyEvaluation.decision,
              label: policyEvaluation.label,
              confidence: policyEvaluation.confidence,
              content_risk_level: policyEvaluation.contentRiskLevel,
              autonomy_risk_level: policyEvaluation.autonomyRiskLevel,
              purchase_mode: policyEvaluation.purchaseMode,
              autonomy_mode: policyEvaluation.autonomyMode,
              reason_codes: policyEvaluation.reasonCodes,
            },
    },
    { status: 201 }
  );
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings");
  }
}
