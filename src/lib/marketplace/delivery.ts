/**
 * Digital Delivery Service
 * Handles automatic delivery of digital goods after purchase completion.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface DeliveryResult {
  success: boolean;
  deliveryType: string;
  data?: Record<string, unknown>;
  error?: string;
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
  const sb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Get listing details
  const { data: listing } = await sb
    .from("marketplace_listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (!listing) {
    return {
      success: false,
      deliveryType: "unknown",
      error: "Listing not found",
    };
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
      return deliverMcpServer(orderId, listing);
    default:
      return {
        success: true,
        deliveryType: listing.listing_type,
        data: { message: "Manual delivery required" },
      };
  }
}

async function deliverApiAccess(
  orderId: string,
  listing: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  buyerId: string
): Promise<DeliveryResult> {
  // Generate a scoped API key for the buyer
  const supabase = createAdminClient();
  const sb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
  listing: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<DeliveryResult> {
  // Generate a time-limited download reference
  // For now, return the documentation_url or demo_url as the download source
  const downloadUrl = listing.documentation_url || listing.demo_url;

  const supabase = createAdminClient();
  const sb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
  listing: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<DeliveryResult> {
  // Prompt templates are delivered as content
  const content =
    listing.agent_config?.prompt_content || listing.description;

  const supabase = createAdminClient();
  await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
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
  listing: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  buyerId: string
): Promise<DeliveryResult> {
  // Deploy agent config and return agent_id + slug
  const agentConfig = listing.agent_config || {};

  const supabase = createAdminClient();
  const sb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Create an agent instance for the buyer
  const { data: agent, error } = await sb
    .from("agents")
    .insert({
      slug: `${listing.slug}-${buyerId.slice(0, 8)}`,
      name: listing.title,
      description: `Purchased agent: ${listing.title}`,
      agent_type: "marketplace",
      owner_id: buyerId,
      status: "active",
      capabilities: agentConfig.capabilities || [],
      config: agentConfig,
      mcp_endpoint: listing.mcp_manifest?.endpoint || null,
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
  listing: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<DeliveryResult> {
  // Return MCP endpoint URL + tool definitions
  const manifest = listing.mcp_manifest || {};

  const supabase = createAdminClient();
  await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("marketplace_orders")
    .update({
      delivery_data: {
        type: "mcp_server",
        endpoint: manifest.endpoint,
        tools: manifest.tools || [],
      },
    })
    .eq("id", orderId);

  return {
    success: true,
    deliveryType: "mcp_server",
    data: { endpoint: manifest.endpoint, tools: manifest.tools },
  };
}
