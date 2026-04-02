/**
 * SEAL Leaderboard Adapter — Stanford/Scale AI Evaluations
 *
 * Fetches model evaluation scores from the SEAL (Scale Evaluation and
 * Assessment of Language models) leaderboard on HuggingFace.
 *
 * Dataset: lmarena-ai/SEAL-Leaderboard
 *
 * SEAL provides high-quality independent evaluation covering both
 * proprietary and open models. Results are aggregated and written
 * to benchmark_scores with source="seal-leaderboard".
 *
 * Uses batch-loaded in-memory matching with 4 strategies for
 * reliable model identification (LiveBench-style matching).
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import {
  buildModelAliasIndex,
  fetchAllActiveAliasModels,
  resolveAliasFamilyModelIds,
} from "../model-alias-resolver";
import { registerAdapter } from "../registry";
import { fetchWithRetry, isPermanentHttpFailure, makeSlug } from "../utils";

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

const HF_DATASET = "lmarena-ai/SEAL-Leaderboard";
const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";
const PAGE_LENGTH = 100;

// SEAL benchmark field → our slug mapping
const SEAL_BENCHMARK_SLUG = "seal";

// Known provider prefixes for slug matching
const PROVIDER_PREFIXES = [
  "anthropic-", "openai-", "google-", "meta-", "meta-llama-",
  "deepseek-", "deepseek-ai-", "mistralai-", "cohere-",
  "xai-", "amazon-", "microsoft-", "nvidia-", "alibaba-",
  "qwen-", "01-ai-", "tiiuae-", "bigcode-", "stabilityai-",
];

const adapter: DataSourceAdapter = {
  id: "seal-leaderboard",
  name: "SEAL Leaderboard",
  outputTypes: ["benchmarks"],
  defaultConfig: {
    maxEntries: 200,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxEntries = (ctx.config.maxEntries as number) ?? 200;
    const errors: { message: string; context?: string }[] = [];
    const sb = ctx.supabase;
    const today = new Date().toISOString().split("T")[0];

    // Fetch rows from HF Datasets API
    const allRows: HFRowContent[] = [];
    let offset = 0;
    let totalRows = Infinity;

    // Use HF token from env for higher rate limits
    const hfToken = process.env.HUGGINGFACE_API_TOKEN || ctx.secrets?.HUGGINGFACE_API_TOKEN || "";
    const fetchHeaders: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "AI-Market-Cap-Bot",
    };
    if (hfToken) fetchHeaders["Authorization"] = `Bearer ${hfToken}`;

    try {
      while (offset < totalRows && allRows.length < maxEntries) {
        const url = new URL(HF_ROWS_API);
        url.searchParams.set("dataset", HF_DATASET);
        url.searchParams.set("config", "default");
        url.searchParams.set("split", "train");
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("length", String(PAGE_LENGTH));

        const res = await fetchWithRetry(
          url.toString(),
          {
            headers: fetchHeaders,
            signal: ctx.signal,
          },
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
                message: `HF Datasets API returned ${res.status}: ${body.slice(0, 200)}`,
                context: isPermanentHttpFailure(res.status, body)
                  ? "permanent_upstream_failure"
                  : "api_error",
              },
            ],
            metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
          };
        }

        const json: HFRowsResponse = await res.json();
        totalRows = json.num_rows_total;

        for (const row of json.rows) {
          allRows.push(row.row);
        }

        offset += PAGE_LENGTH;
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
            message: `Failed to fetch SEAL Leaderboard: ${err instanceof Error ? err.message : String(err)}`,
            context: "network_error",
          },
        ],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    if (allRows.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "SEAL Leaderboard returned empty data", context: "empty_response" }],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    // Detect columns from first row for flexible parsing
    const firstRow = allRows[0];
    const columns = Object.keys(firstRow);

    // Try to identify score and model columns dynamically
    const scoreColumn = columns.find(c =>
      /^(score|overall|average|total|rating|composite)/i.test(c)
    ) ?? columns.find(c => typeof firstRow[c] === "number") ?? "Score";

    const modelColumn = columns.find(c =>
      /^(model|name|model_name|fullname)/i.test(c)
    ) ?? "Model";

    // Sort by score descending
    allRows.sort((a, b) => {
      const scoreA = Number(a[scoreColumn]) || 0;
      const scoreB = Number(b[scoreColumn]) || 0;
      return scoreB - scoreA;
    });

    const entries = allRows.slice(0, maxEntries);
    let recordsProcessed = 0;
    let recordsCreated = 0;

    // Look up SEAL benchmark ID
    const { data: benchmarkRows } = await sb
      .from("benchmarks")
      .select("id")
      .eq("slug", SEAL_BENCHMARK_SLUG)
      .limit(1);
    const sealBenchmarkId = benchmarkRows?.[0]?.id ?? null;

    // ── Batch model lookup for efficient matching ──
    const allModels = await fetchAllActiveAliasModels(sb);
    const modelAliasIndex = buildModelAliasIndex(allModels);

    // Build multiple lookup indexes
    const slugToId = new Map<string, string>();
    const nameLowerToId = new Map<string, string>();

    for (const m of allModels) {
      slugToId.set(m.slug, m.id);
      nameLowerToId.set(m.name.toLowerCase(), m.id);

      const providerSlug = makeSlug(m.provider);
      if (m.slug.startsWith(providerSlug + "-")) {
        const withoutPrefix = m.slug.slice(providerSlug.length + 1);
        if (!slugToId.has(withoutPrefix)) {
          slugToId.set(withoutPrefix, m.id);
        }
      }
    }

    function findModelId(rawName: string): string | null {
      const slug = makeSlug(rawName);
      const shortName = rawName.split("/").pop() ?? rawName;
      const shortSlug = makeSlug(shortName);

      // Strategy 1: Direct slug match
      if (slugToId.has(slug)) return slugToId.get(slug)!;
      if (slugToId.has(shortSlug)) return slugToId.get(shortSlug)!;

      // Strategy 2: Try with provider prefixes
      for (const prefix of PROVIDER_PREFIXES) {
        if (slugToId.has(prefix + slug)) return slugToId.get(prefix + slug)!;
        if (slugToId.has(prefix + shortSlug)) return slugToId.get(prefix + shortSlug)!;
      }

      // Strategy 3: Fuzzy name match
      const nameWithSpaces = shortName.replace(/-/g, " ").toLowerCase();
      const nameWithDots = shortName
        .replace(/(\d)-(\d)/g, "$1.$2")
        .replace(/-/g, " ")
        .toLowerCase();

      for (const [dbName, id] of nameLowerToId) {
        if (dbName === nameWithSpaces || dbName === nameWithDots) return id;
        if (dbName.includes(nameWithSpaces) || dbName.includes(nameWithDots)) return id;
      }

      // Strategy 4: Contained slug match
      for (const [dbSlug, id] of slugToId) {
        if (dbSlug.endsWith("-" + slug) || dbSlug.endsWith("-" + shortSlug)) return id;
      }

      return null;
    }

    function findAllModelIds(rawName: string): string[] {
      const primaryId = findModelId(rawName);
      if (!primaryId) return [];

      const slug = makeSlug(rawName);
      const shortName = rawName.split("/").pop() ?? rawName;
      const shortSlug = makeSlug(shortName);
      const nameWithSpaces = shortName.replace(/-/g, " ").toLowerCase();
      const nameWithDots = shortName
        .replace(/(\d)-(\d)/g, "$1.$2")
        .replace(/-/g, " ")
        .toLowerCase();
      const relatedIds = resolveAliasFamilyModelIds(modelAliasIndex, {
        slugCandidates: [
          slug,
          shortSlug,
          ...PROVIDER_PREFIXES.map((prefix) => `${prefix}${slug}`),
          ...PROVIDER_PREFIXES.map((prefix) => `${prefix}${shortSlug}`),
        ],
        nameCandidates: [rawName, shortName, nameWithSpaces, nameWithDots],
      });

      return relatedIds.length > 0 ? relatedIds : [primaryId];
    }

    let matchedCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const rank = i + 1;

      const modelName = (row[modelColumn] as string) ?? "";
      if (!modelName) continue;

      const score = Number(row[scoreColumn]);
      if (isNaN(score)) continue;

      recordsProcessed++;

      const modelSlug = makeSlug(modelName);
      const allModelIds = findAllModelIds(modelName);
      const modelId = allModelIds[0] ?? null;

      if (allModelIds.length > 0) matchedCount++;

      // Store as news entry for traceability
      const newsRecord = {
        source: "seal-leaderboard",
        source_id: `seal-${modelSlug}-${today}`,
        title: `${modelName} — SEAL Leaderboard #${rank}`,
        related_model_ids: modelId ? [modelId] : [],
        summary: `Score: ${score.toFixed(1)} | Rank: #${rank}`,
        url: "https://huggingface.co/spaces/lmarena-ai/SEAL-Leaderboard",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: null,
        tags: ["benchmark", "seal-leaderboard"],
        metadata: {
          rank,
          score,
          model_id: modelId ?? null,
        },
      };

      const { error: newsError } = await sb
        .from("model_news")
        .upsert(newsRecord, { onConflict: "source,source_id" });

      if (newsError) {
        errors.push({
          message: `News upsert for ${modelName}: ${newsError.message}`,
        });
      }

      // Write structured benchmark_score
      if (allModelIds.length === 0 || !sealBenchmarkId) continue;

      const normalizedScore = score > 1 ? score : score * 100;

      for (const targetModelId of allModelIds) {
        const { error: scoreError } = await sb
          .from("benchmark_scores")
          .upsert(
            {
              model_id: targetModelId,
              benchmark_id: sealBenchmarkId,
              score,
              score_normalized: normalizedScore,
              model_version: "",
              source: "seal-leaderboard",
              evaluation_date: today,
            },
            { onConflict: "model_id,benchmark_id,model_version" }
          );

        if (scoreError) {
          errors.push({
            message: `benchmark_scores upsert for ${modelName}/seal: ${scoreError.message}`,
          });
        } else {
          recordsCreated++;
        }
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: {
        source: "hf_datasets_api",
        dataset: HF_DATASET,
        totalRowsFetched: allRows.length,
        detectedColumns: columns,
        scoreColumn,
        modelColumn,
        matchedModels: matchedCount,
        matchRate: `${((matchedCount / Math.max(recordsProcessed, 1)) * 100).toFixed(1)}%`,
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
          message: "HF Datasets API reachable for SEAL Leaderboard",
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `HF Datasets API returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
