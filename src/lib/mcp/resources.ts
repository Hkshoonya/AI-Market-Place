/**
 * MCP Resources -- Resource definitions and readers
 */

import type { McpResource } from "./types";
import type { TypedSupabaseClient } from "@/types/database";
import { getModelDisplayDescription } from "@/lib/models/presentation";

export const MCP_RESOURCES: McpResource[] = [
  {
    uri: "models://catalog",
    name: "AI Model Catalog",
    description: "Complete catalog of tracked AI models with metadata",
    mimeType: "application/json",
  },
  {
    uri: "rankings://leaderboard",
    name: "Model Rankings",
    description: "Current AI model leaderboard rankings by quality score",
    mimeType: "application/json",
  },
  {
    uri: "marketplace://listings",
    name: "Marketplace Listings",
    description: "Active marketplace listings for AI products and services",
    mimeType: "application/json",
  },
  {
    uri: "agents://directory",
    name: "Agent Directory",
    description: "Registry of all agents on the platform",
    mimeType: "application/json",
  },
];

/** Read a resource by URI */
export async function readResource(
  supabase: TypedSupabaseClient,
  uri: string
): Promise<unknown> {
  const sb = supabase;

  switch (uri) {
    case "models://catalog": {
      const { data } = await sb
        .from("models")
        .select("slug, name, provider, category, status, quality_score, hf_downloads, overall_rank, is_open_weights, release_date, description, short_description")
        .eq("status", "active")
        .order("overall_rank", { ascending: true, nullsFirst: false })
        .limit(500);
      return {
        models: (data ?? []).map((model) => ({
          ...model,
          display_description: getModelDisplayDescription(model).text,
        })),
        count: (data ?? []).length,
      };
    }

    case "rankings://leaderboard": {
      const { data } = await sb
        .from("models")
        .select("slug, name, provider, category, quality_score, overall_rank, hf_downloads")
        .eq("status", "active")
        .not("overall_rank", "is", null)
        .order("overall_rank", { ascending: true })
        .limit(100);
      return { rankings: data ?? [] };
    }

    case "marketplace://listings": {
      const { data } = await sb
        .from("marketplace_listings")
        .select("slug, title, listing_type, pricing_type, price, currency, avg_rating, view_count, is_featured")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200);
      return { listings: data ?? [] };
    }

    case "agents://directory": {
      const { data } = await sb
        .from("agents")
        .select("slug, name, description, agent_type, status, capabilities, last_active_at")
        .order("name", { ascending: true });
      return { agents: data ?? [] };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}
