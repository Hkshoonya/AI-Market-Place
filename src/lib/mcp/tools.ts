/**
 * MCP Tools -- Tool definitions and execution handlers
 *
 * Each tool maps to platform capabilities that bots can invoke.
 */

import type { McpTool } from "./types";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { getOrCreateWallet, getWalletBalance } from "@/lib/payments/wallet";
import { createPurchaseEscrow, completePurchaseEscrow } from "@/lib/marketplace/escrow";
import { deliverDigitalGood } from "@/lib/marketplace/delivery";

export const MCP_TOOLS: McpTool[] = [
  {
    name: "search_models",
    description: "Search AI models by name, category, or provider",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category: { type: "string", description: "Filter by category (llm, image_generation, etc.)" },
        limit: { type: "number", description: "Max results (default 20, max 100)" },
      },
    },
  },
  {
    name: "get_model",
    description: "Get detailed info about a specific AI model by slug",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Model slug (e.g., 'gpt-4o', 'claude-4-opus')" },
      },
      required: ["slug"],
    },
  },
  {
    name: "list_rankings",
    description: "Get AI model leaderboard rankings",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "get_trending",
    description: "Get trending, newest, and popular AI models",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["trending", "recent", "popular"], description: "Type of trending list" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
  },
  {
    name: "browse_marketplace",
    description: "Browse marketplace listings for AI model products",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Listing type filter (api_access, model_weights, agent, etc.)" },
        query: { type: "string", description: "Search query" },
        sort: { type: "string", enum: ["newest", "price_asc", "price_desc", "rating", "popular"] },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "get_listing",
    description: "Get detailed info about a marketplace listing by slug",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Listing slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "create_order",
    description: "Place an order on a marketplace listing (requires 'write' scope)",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "string", description: "Listing UUID" },
        message: { type: "string", description: "Optional message to seller" },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "purchase",
    description: "Purchase a marketplace listing with wallet balance, escrow, and auto-delivery",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "string", description: "Listing UUID" },
        message: { type: "string", description: "Optional message to seller" },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "list_agents",
    description: "List registered agents on the platform",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["resident", "marketplace", "visitor"], description: "Agent type filter" },
        status: { type: "string", enum: ["active", "paused"], description: "Status filter" },
      },
    },
  },
  {
    name: "send_message",
    description: "Send a message to a resident agent and get a response (requires 'agent' scope)",
    inputSchema: {
      type: "object",
      properties: {
        agent_slug: { type: "string", description: "Target agent slug (e.g., 'pipeline-engineer', 'code-quality')" },
        message: { type: "string", description: "Message content to send" },
        topic: { type: "string", description: "Optional conversation topic" },
      },
      required: ["agent_slug", "message"],
    },
  },
];

/** Execute a tool call and return the result */
export async function executeTool(
  supabase: unknown,
  toolName: string,
  params: Record<string, unknown>,
  keyRecord?: Record<string, unknown>
): Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  switch (toolName) {
    case "search_models": {
      const query = (params.query as string) ?? "";
      const category = params.category as string | undefined;
      const limit = Math.min((params.limit as number) ?? 20, 100);

      let q = sb
        .from("models")
        .select("slug, name, provider, category, description, quality_score, hf_downloads, overall_rank, is_open_weights")
        .eq("status", "active")
        .order("quality_score", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (query) q = q.ilike("name", `%${sanitizeFilterValue(query)}%`);
      if (category) q = q.eq("category", category);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { models: data ?? [], count: (data ?? []).length };
    }

    case "get_model": {
      const slug = params.slug as string;
      if (!slug) throw new Error("slug is required");

      const { data, error } = await sb
        .from("models")
        .select("*, benchmark_scores(*, benchmark:benchmarks(*)), model_pricing(*), elo_ratings(*), rankings(*)")
        .eq("slug", slug)
        .single();

      if (error) throw new Error(`Model not found: ${slug}`);
      return data;
    }

    case "list_rankings": {
      const category = params.category as string | undefined;
      const limit = Math.min((params.limit as number) ?? 20, 100);

      let q = sb
        .from("models")
        .select("slug, name, provider, category, quality_score, overall_rank, hf_downloads, is_open_weights")
        .eq("status", "active")
        .not("overall_rank", "is", null)
        .order("overall_rank", { ascending: true })
        .limit(limit);

      if (category) q = q.eq("category", category);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { rankings: data ?? [] };
    }

    case "get_trending": {
      const type = (params.type as string) ?? "trending";
      const limit = Math.min((params.limit as number) ?? 10, 50);

      let orderCol = "hf_trending_score";
      if (type === "recent") orderCol = "release_date";
      if (type === "popular") orderCol = "hf_downloads";

      const { data, error } = await sb
        .from("models")
        .select("slug, name, provider, category, quality_score, hf_downloads, hf_trending_score, release_date")
        .eq("status", "active")
        .order(orderCol, { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return { [type]: data ?? [] };
    }

    case "browse_marketplace": {
      const type = params.type as string | undefined;
      const query = params.query as string | undefined;
      const sort = (params.sort as string) ?? "newest";
      const limit = Math.min((params.limit as number) ?? 20, 100);

      // Two-query approach: marketplace_listings has no FK to profiles
      let q = sb
        .from("marketplace_listings")
        .select("slug, title, short_description, listing_type, pricing_type, price, currency, avg_rating, review_count, view_count, is_featured, created_at, seller_id")
        .eq("status", "active")
        .limit(limit);

      if (type) q = q.eq("listing_type", type);
      if (query) q = q.ilike("title", `%${sanitizeFilterValue(query)}%`);

      switch (sort) {
        case "price_asc": q = q.order("price", { ascending: true, nullsFirst: false }); break;
        case "price_desc": q = q.order("price", { ascending: false, nullsFirst: false }); break;
        case "rating": q = q.order("avg_rating", { ascending: false, nullsFirst: false }); break;
        case "popular": q = q.order("view_count", { ascending: false }); break;
        default: q = q.order("created_at", { ascending: false });
      }

      const { data: rawListings, error } = await q;
      if (error) throw new Error(error.message);

      // Enrich with seller profiles
      let listings = rawListings ?? [];
      if (listings.length > 0) {
        const sellerIds = [...new Set(listings.map((l: any) => l.seller_id).filter(Boolean))];
        if (sellerIds.length > 0) {
          const { data: profiles } = await sb.from("profiles").select("id, display_name, username, seller_verified").in("id", sellerIds);
          const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
          listings = listings.map((l: any) => ({ ...l, profiles: l.seller_id ? profileMap.get(l.seller_id) ?? null : null }));
        }
      }

      return { listings, count: listings.length };
    }

    case "get_listing": {
      const slug = params.slug as string;
      if (!slug) throw new Error("slug is required");

      // Two-query approach: marketplace_listings has no FK to profiles
      const { data: rawListing, error } = await sb
        .from("marketplace_listings")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

      if (error || !rawListing) throw new Error(`Listing not found: ${slug}`);

      // Enrich with seller profile
      let data = { ...rawListing, profiles: null as any };
      if (rawListing.seller_id) {
        const { data: profile } = await sb
          .from("profiles")
          .select("id, display_name, username, avatar_url, seller_verified, seller_rating, total_sales, seller_bio, seller_website")
          .eq("id", rawListing.seller_id)
          .single();
        data.profiles = profile ?? null;
      }

      return data;
    }

    case "purchase":
    case "create_order": {
      const scopes = (keyRecord?.scopes as string[]) ?? [];
      if (!scopes.includes("write") && !scopes.includes("marketplace")) {
        throw new Error("Requires 'write' or 'marketplace' scope");
      }

      const listingId = params.listing_id as string;
      if (!listingId) throw new Error("listing_id is required");

      // Get listing (must be active)
      const { data: listing, error: listErr } = await sb
        .from("marketplace_listings")
        .select("id, seller_id, price, pricing_type, listing_type, status")
        .eq("id", listingId)
        .eq("status", "active")
        .single();

      if (listErr || !listing) throw new Error("Listing not found or not active");

      const ownerId = (keyRecord?.owner_id as string) ?? "";
      if (listing.seller_id === ownerId) throw new Error("Cannot order your own listing");

      const price = listing.price ?? 0;

      // Wallet & balance check
      const wallet = await getOrCreateWallet(ownerId);
      if (price > 0) {
        const balance = await getWalletBalance(wallet.id);
        if (balance.available < price) {
          throw new Error(
            `Insufficient wallet balance. Required: ${price}, available: ${balance.available}`
          );
        }
      }

      // Create order record
      const { data: order, error: orderErr } = await sb
        .from("marketplace_orders")
        .insert({
          listing_id: listingId,
          buyer_id: ownerId,
          seller_id: listing.seller_id,
          status: "pending",
          message: (params.message as string) ?? null,
          price_at_time: price,
        })
        .select("id, status, price_at_time, created_at")
        .single();

      if (orderErr) throw new Error(`Order failed: ${orderErr.message}`);

      // Create escrow hold if price > 0
      let escrowId: string | null = null;
      if (price > 0) {
        const escrowResult = await createPurchaseEscrow(
          ownerId,
          listing.seller_id,
          price,
          order.id
        );
        escrowId = escrowResult.escrowId;
      }

      // Auto-deliver for one_time or free listings
      let delivery = null;
      const pricingType = listing.pricing_type ?? "one_time";
      if (pricingType === "one_time" || pricingType === "free") {
        try {
          delivery = await deliverDigitalGood(order.id, listingId, ownerId);

          if (delivery.success) {
            // Mark order completed
            await sb
              .from("marketplace_orders")
              .update({ status: "completed" })
              .eq("id", order.id);
            order.status = "completed";

            // Release escrow to seller if price > 0
            if (price > 0 && escrowId) {
              await completePurchaseEscrow(order.id);
            }
          }
        } catch (deliveryErr) {
          // Delivery failed but order is still created -- buyer can retry
          delivery = {
            success: false,
            deliveryType: "unknown",
            error: deliveryErr instanceof Error ? deliveryErr.message : "Delivery failed",
          };
        }
      }

      return { ...order, escrow_id: escrowId, delivery };
    }

    case "list_agents": {
      const type = params.type as string | undefined;
      const status = params.status as string | undefined;

      let q = sb
        .from("agents")
        .select("slug, name, description, agent_type, status, capabilities, last_active_at, total_tasks_completed, total_conversations")
        .order("name", { ascending: true });

      if (type) q = q.eq("agent_type", type);
      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { agents: data ?? [] };
    }

    case "send_message": {
      const scopes = (keyRecord?.scopes as string[]) ?? [];
      if (!scopes.includes("agent")) {
        throw new Error("Requires 'agent' scope");
      }

      const agentSlug = params.agent_slug as string;
      const message = params.message as string;
      if (!agentSlug || !message) throw new Error("agent_slug and message are required");

      // Import chat utilities dynamically to avoid circular deps
      const { findOrCreateConversation, sendMessage, generateAgentResponse } =
        await import("@/lib/agents/chat");

      // Find the target agent
      const { data: agent, error: agentErr } = await sb
        .from("agents")
        .select("id, slug, name, status")
        .eq("slug", agentSlug)
        .single();

      if (agentErr || !agent) throw new Error(`Agent "${agentSlug}" not found`);
      if (agent.status !== "active") throw new Error(`Agent "${agentSlug}" is ${agent.status}`);

      const senderId = (keyRecord?.owner_id as string) ?? "";
      const senderType = keyRecord?.agent_id ? "agent" : "user";

      const { conversation } = await findOrCreateConversation(
        sb, senderId, senderType as "agent" | "user",
        agent.id, "agent", (params.topic as string) ?? undefined
      );

      const sent = await sendMessage(
        sb, conversation.id, senderId,
        senderType as "agent" | "user", message, "text"
      );

      const response = await generateAgentResponse(
        sb, agentSlug, conversation.id, message
      );

      return {
        conversation_id: conversation.id,
        message: sent,
        response,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
