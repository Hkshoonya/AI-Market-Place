/**
 * Digital Delivery Service
 * Handles automatic delivery of digital goods after purchase completion.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketplaceListing } from "@/types/database";
import { buildOrderFulfillmentManifest } from "@/lib/marketplace/manifest";

export interface DeliveryResult {
  success: boolean;
  deliveryType: string;
  data?: Record<string, unknown>;
  error?: string;
}

function asManifestObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Auto-deliver a digital good based on listing type.
 * Called after order is completed and payment confirmed.
 */
export async function deliverDigitalGood(
  orderId: string,
  listingId: string,
  buyerId: string
): Promise<DeliveryResult> {
  const supabase = createAdminClient();
  const sb = supabase;

  // Get listing details
  const { data: listing } = await sb
    .from("marketplace_listings")
    .select("*")
    .eq("id", listingId)
    .single();

  const { data: order } = await sb
    .from("marketplace_orders")
    .select("id, listing_id, buyer_id, seller_id, created_at, fulfillment_manifest_snapshot")
    .eq("id", orderId)
    .single();

  if (!listing) {
    return {
      success: false,
      deliveryType: "unknown",
      error: "Listing not found",
    };
  }

  let fulfillmentManifest = asManifestObject(
    order?.fulfillment_manifest_snapshot
  );

  if (!fulfillmentManifest && order) {
    fulfillmentManifest = buildOrderFulfillmentManifest({
      listing: {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        description: listing.description,
        short_description: listing.short_description ?? null,
        listing_type: listing.listing_type,
        pricing_type: listing.pricing_type,
        price: listing.price,
        currency: listing.currency,
        documentation_url: listing.documentation_url ?? null,
        demo_url: listing.demo_url ?? null,
        tags: listing.tags ?? [],
        agent_config: listing.agent_config ?? null,
        mcp_manifest: listing.mcp_manifest ?? null,
        preview_manifest: listing.preview_manifest ?? null,
      },
      order: {
        id: order.id,
        listing_id: order.listing_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        created_at: order.created_at,
        price_at_time: listing.price,
      },
    });

    await sb
      .from("marketplace_orders")
      .update({
        fulfillment_manifest_snapshot: fulfillmentManifest,
      })
      .eq("id", orderId);
  }

  switch (listing.listing_type) {
    case "api_access":
      return deliverApiAccess(orderId, listing, buyerId);
    case "model_weights":
    case "dataset":
    case "fine_tuned_model":
      return deliverDownloadable(orderId, listing);
    case "prompt_template":
      return deliverPromptTemplate(orderId, listing);
    case "agent":
      return deliverAgent(orderId, listing, buyerId);
    case "mcp_server":
      return deliverMcpServer(orderId, listing, fulfillmentManifest);
    default:
      return {
        success: true,
        deliveryType: listing.listing_type,
        data: { message: "Manual delivery required" },
      };
  }
}

async function ensureAccountBoundBuyer(
  buyerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const sb = supabase;

  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("id", buyerId)
    .single();

  if (!profile) {
    return {
      ok: false,
      error:
        "Account required: sign in to receive this product automatically.",
    };
  }

  return { ok: true };
}

async function deliverApiAccess(
  orderId: string,
  listing: MarketplaceListing,
  buyerId: string
): Promise<DeliveryResult> {
  const accountCheck = await ensureAccountBoundBuyer(buyerId);
  if (!accountCheck.ok) {
    return {
      success: false,
      deliveryType: "api_access",
      error: accountCheck.error,
    };
  }

  // Generate a scoped API key for the buyer
  const supabase = createAdminClient();
  const sb = supabase;

  const crypto = await import("crypto");
  const rawKey = `aimk_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const { data: apiKey, error } = await sb
    .from("api_keys")
    .insert({
      owner_id: buyerId,
      name: `Access: ${listing.title}`,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: ["marketplace_access", listing.slug],
      rate_limit_per_minute: 60,
      is_active: true,
    })
    .select("id, key_prefix")
    .single();

  if (error) {
    return {
      success: false,
      deliveryType: "api_access",
      error: "Failed to generate API key",
    };
  }

  // Store only key reference on the order (not the raw key — shown once in response)
  await sb
    .from("marketplace_orders")
    .update({
      delivery_data: {
        type: "api_access",
        key_id: apiKey.id,
        key_prefix: keyPrefix,
      },
    })
    .eq("id", orderId);

  return {
    success: true,
    deliveryType: "api_access",
    data: { api_key: rawKey, key_prefix: keyPrefix },
  };
}

async function deliverDownloadable(
  orderId: string,
  listing: MarketplaceListing
): Promise<DeliveryResult> {
  // Generate a time-limited download reference
  // For now, return the documentation_url or demo_url as the download source
  const downloadUrl = listing.documentation_url || listing.demo_url;

  const supabase = createAdminClient();
  const sb = supabase;

  await sb
    .from("marketplace_orders")
    .update({
      delivery_data: {
        type: listing.listing_type,
        download_url: downloadUrl,
        expires_at: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    })
    .eq("id", orderId);

  return {
    success: true,
    deliveryType: listing.listing_type,
    data: { download_url: downloadUrl },
  };
}

async function deliverPromptTemplate(
  orderId: string,
  listing: MarketplaceListing
): Promise<DeliveryResult> {
  // Prompt templates are delivered as content
  const content =
    listing.agent_config?.prompt_content || listing.description;

  const supabase = createAdminClient();
  await supabase
    .from("marketplace_orders")
    .update({ delivery_data: { type: "prompt_template", content } })
    .eq("id", orderId);

  return {
    success: true,
    deliveryType: "prompt_template",
    data: { content },
  };
}

async function deliverAgent(
  orderId: string,
  listing: MarketplaceListing,
  buyerId: string
): Promise<DeliveryResult> {
  const accountCheck = await ensureAccountBoundBuyer(buyerId);
  if (!accountCheck.ok) {
    return {
      success: false,
      deliveryType: "agent",
      error: accountCheck.error,
    };
  }

  // Deploy agent config and return agent_id + slug
  const agentConfig = listing.agent_config || {};

  const supabase = createAdminClient();
  const sb = supabase;

  // Create an agent instance for the buyer
  const capabilities = Array.isArray(agentConfig.capabilities)
    ? (agentConfig.capabilities as string[])
    : [];
  const mcpEndpoint =
    typeof listing.mcp_manifest?.endpoint === "string"
      ? listing.mcp_manifest.endpoint
      : null;

  const { data: agent, error } = await sb
    .from("agents")
    .insert({
      slug: `${listing.slug}-${buyerId.slice(0, 8)}`,
      name: listing.title,
      description: `Purchased agent: ${listing.title}`,
      agent_type: "marketplace" as const,
      owner_id: buyerId,
      status: "active" as const,
      capabilities,
      config: agentConfig,
      mcp_endpoint: mcpEndpoint,
    })
    .select("id, slug")
    .single();

  if (error) {
    return {
      success: false,
      deliveryType: "agent",
      error: "Failed to deploy agent",
    };
  }

  await sb
    .from("marketplace_orders")
    .update({
      delivery_data: {
        type: "agent",
        agent_id: agent.id,
        agent_slug: agent.slug,
      },
    })
    .eq("id", orderId);

  return {
    success: true,
    deliveryType: "agent",
    data: { agent_id: agent.id, agent_slug: agent.slug },
  };
}

async function deliverMcpServer(
  orderId: string,
  listing: MarketplaceListing,
  fulfillmentManifest?: Record<string, unknown> | null
): Promise<DeliveryResult> {
  // Return MCP endpoint URL + tool definitions
  const manifest = listing.mcp_manifest || {};
  const snapshotAccess = asManifestObject(fulfillmentManifest?.access);
  const snapshotArtifacts = asManifestObject(fulfillmentManifest?.artifacts);
  const endpoint =
    typeof snapshotAccess?.endpoint === "string"
      ? snapshotAccess.endpoint
      : manifest.endpoint;
  const tools =
    Array.isArray(snapshotArtifacts?.tools)
      ? snapshotArtifacts.tools
      : manifest.tools || [];

  const supabase = createAdminClient();
  await supabase
    .from("marketplace_orders")
    .update({
      delivery_data: {
        type: "mcp_server",
        endpoint,
        tools,
      },
    })
    .eq("id", orderId);

  return {
    success: true,
    deliveryType: "mcp_server",
    data: { endpoint, tools },
  };
}
