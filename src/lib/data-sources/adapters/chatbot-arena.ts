/**
 * Chatbot Arena / LMSYS Elo Ratings Adapter (Live API)
 *
 * Fetches the Chatbot Arena leaderboard data from the HuggingFace
 * datasets API (mathewhe/chatbot-arena-elo — a public mirror of the
 * lmarena-ai leaderboard scores).
 * No static fallback — sync fails if the API is unreachable.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug } from "../utils";

// --------------- HuggingFace Datasets API Types ---------------

interface HFRowContent {
  [key: string]: unknown;
}

interface HFRow {
  row_idx: number;
  row: HFRowContent;
}

interface HFRowsResponse {
  features: { feature_idx: number; name: string; type: unknown }[];
  rows: HFRow[];
  num_rows_total: number;
  num_rows_per_page: number;
  partial: boolean;
}

// --------------- Constants ---------------

const HF_DATASET = "mathewhe/chatbot-arena-elo";
const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";
const PAGE_LENGTH = 100;

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "chatbot-arena",
  name: "Chatbot Arena",
  outputTypes: ["elo_ratings"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: { message: string; context?: string }[] = [];
    const sb = ctx.supabase;
    const today = new Date().toISOString().split("T")[0];

    // Fetch all rows from the HuggingFace datasets API with pagination
    const allRows: HFRowContent[] = [];
    let offset = 0;
    let totalRows = Infinity;

    try {
      while (offset < totalRows) {
        const url = new URL(HF_ROWS_API);
        url.searchParams.set("dataset", HF_DATASET);
        url.searchParams.set("config", "default");
        url.searchParams.set("split", "train");
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("length", String(PAGE_LENGTH));

        const res = await fetchWithRetry(
          url.toString(),
          { signal: ctx.signal },
          { signal: ctx.signal }
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            errors: [
              {
                message: `HuggingFace datasets API returned ${res.status}: ${body.slice(0, 200)}`,
              },
            ],
          };
        }

        const json: HFRowsResponse = await res.json();
        totalRows = json.num_rows_total;

        for (const row of json.rows) {
          allRows.push(row.row);
        }

        offset += PAGE_LENGTH;

        // Safety: if the page returned no rows, stop
        if (json.rows.length === 0) break;
      }
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch Chatbot Arena data: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    if (allRows.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "No rows returned from Chatbot Arena dataset" }],
      };
    }

    let recordsProcessed = 0;
    let recordsCreated = 0;

    // ── Batch model lookup (avoid N+1 queries) ──
    const { data: allModelsRaw } = await sb
      .from("models")
      .select("id, slug, name, provider")
      .eq("status", "active");
    const allModels = (allModelsRaw ?? []) as {
      id: string; slug: string; name: string; provider: string;
    }[];

    const slugToId = new Map<string, string>();
    const nameLowerToId = new Map<string, string>();
    for (const m of allModels) {
      slugToId.set(m.slug, m.id);
      nameLowerToId.set(m.name.toLowerCase(), m.id);
    }

    function findModelId(rawName: string): string | null {
      const slug = makeSlug(rawName);
      // Direct slug match
      if (slugToId.has(slug)) return slugToId.get(slug)!;
      // Name match (case-insensitive)
      const lowerName = rawName.toLowerCase();
      if (nameLowerToId.has(lowerName)) return nameLowerToId.get(lowerName)!;
      // Partial name match
      for (const [dbName, id] of nameLowerToId) {
        if (dbName.includes(lowerName) || lowerName.includes(dbName)) return id;
      }
      // Partial slug match (endsWith)
      for (const [dbSlug, id] of slugToId) {
        if (dbSlug.endsWith("-" + slug) || slug.endsWith("-" + dbSlug)) return id;
      }
      return null;
    }

    for (const row of allRows) {
      // mathewhe/chatbot-arena-elo columns:
      // "Model", "Arena Score", "95% CI", "Votes", "Rank* (UB)", "Organization"
      const modelName =
        (row["Model"] as string) ??
        (row["model"] as string) ??
        (row["model_name"] as string) ??
        (row["key"] as string);

      if (!modelName) continue;

      // Extract Elo / Arena score
      const eloScore =
        (row["Arena Score"] as number) ??
        (row["arena_score"] as number) ??
        (row["elo"] as number) ??
        (row["rating"] as number) ??
        (row["score"] as number);

      // Parse "95% CI" field (format: "+5/-4") into low/high
      let ciLow: number | null = null;
      let ciHigh: number | null = null;
      const ciStr = row["95% CI"] as string | undefined;
      if (ciStr && eloScore != null) {
        const ciMatch = ciStr.match(/\+(\d+)\/-(\d+)/);
        if (ciMatch) {
          ciHigh = eloScore + parseInt(ciMatch[1], 10);
          ciLow = eloScore - parseInt(ciMatch[2], 10);
        }
      }
      // Fallback to explicit fields if present
      ciLow ??=
        (row["confidence_interval_low"] as number) ??
        (row["CI_low"] as number) ??
        null;
      ciHigh ??=
        (row["confidence_interval_high"] as number) ??
        (row["CI_high"] as number) ??
        null;

      const votes =
        (row["Votes"] as number) ??
        (row["votes"] as number) ??
        (row["num_battles"] as number) ??
        (row["num_votes"] as number) ??
        null;

      const rank =
        (row["Rank* (UB)"] as number) ??
        (row["rank"] as number) ??
        (row["Rank"] as number) ??
        (row["final_ranking"] as number) ??
        null;

      if (eloScore == null) continue;

      recordsProcessed++;

      const modelId = findModelId(modelName);
      if (!modelId) continue;

      const { error } = await sb.from("elo_ratings").upsert(
        {
          model_id: modelId,
          arena_name: "chatbot-arena",
          elo_score: eloScore,
          confidence_interval_low: ciLow,
          confidence_interval_high: ciHigh,
          num_battles: votes,
          rank,
          snapshot_date: today,
        },
        { onConflict: "model_id,arena_name,snapshot_date" }
      );

      if (error) {
        errors.push({
          message: `Elo upsert for ${modelName}: ${error.message}`,
        });
      } else {
        recordsCreated++;
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: {
        source: "huggingface_datasets_api",
        dataset: HF_DATASET,
        totalRowsFetched: allRows.length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const url = new URL(HF_ROWS_API);
      url.searchParams.set("dataset", HF_DATASET);
      url.searchParams.set("config", "default");
      url.searchParams.set("split", "train");
      url.searchParams.set("offset", "0");
      url.searchParams.set("length", "1");

      const res = await fetchWithRetry(url.toString(), {}, { maxRetries: 1 });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          healthy: true,
          latencyMs,
          message: "HuggingFace datasets API reachable for Chatbot Arena data",
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `HuggingFace datasets API returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `HuggingFace datasets API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
