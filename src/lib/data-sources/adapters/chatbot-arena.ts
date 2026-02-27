/**
 * Chatbot Arena / LMSYS Elo Ratings Adapter (Live API)
 *
 * Fetches the Chatbot Arena leaderboard data from the HuggingFace
 * datasets API (lmsys/chatbot_arena_leaderboard).
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

const HF_DATASET = "lmsys/chatbot_arena_leaderboard";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = ctx.supabase as any;
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

    for (const row of allRows) {
      // The dataset may use different column names — try common ones
      const modelName =
        (row["model"] as string) ??
        (row["Model"] as string) ??
        (row["model_name"] as string) ??
        (row["key"] as string);

      if (!modelName) continue;

      // Extract Elo / Arena score — field names vary across dataset versions
      const eloScore =
        (row["arena_score"] as number) ??
        (row["Arena Score"] as number) ??
        (row["elo"] as number) ??
        (row["rating"] as number) ??
        (row["score"] as number);

      const ciLow =
        (row["confidence_interval_low"] as number) ??
        (row["CI_low"] as number) ??
        (row["ci_low"] as number) ??
        (row["lower"] as number) ??
        null;

      const ciHigh =
        (row["confidence_interval_high"] as number) ??
        (row["CI_high"] as number) ??
        (row["ci_high"] as number) ??
        (row["upper"] as number) ??
        null;

      const votes =
        (row["num_battles"] as number) ??
        (row["votes"] as number) ??
        (row["num_votes"] as number) ??
        (row["Votes"] as number) ??
        null;

      const rank =
        (row["rank"] as number) ??
        (row["Rank"] as number) ??
        (row["final_ranking"] as number) ??
        null;

      if (eloScore == null) continue;

      recordsProcessed++;

      const modelSlug = makeSlug(modelName);

      // Find model in our DB by slug or name
      const { data: models } = await sb
        .from("models")
        .select("id")
        .or(`slug.eq.${modelSlug},name.ilike.%${modelName}%`)
        .limit(1);

      const model = models?.[0];
      if (!model?.id) continue;

      const { error } = await sb.from("elo_ratings").upsert(
        {
          model_id: model.id,
          arena_name: "chatbot-arena",
          elo_score: eloScore,
          confidence_interval_low: ciLow,
          confidence_interval_high: ciHigh,
          num_battles: votes,
          rank,
          snapshot_date: today,
        },
        { onConflict: "model_id,arena_name" }
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
