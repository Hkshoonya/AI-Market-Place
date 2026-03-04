/**
 * BigCodeBench Results Adapter — Code Benchmarks
 *
 * Fetches model code benchmark scores from the BigCodeBench Results dataset
 * (bigcode/bigcodebench-results) on HuggingFace.
 *
 * Columns: model, complete, instruct, size, date, type, moe
 * Scores are mapped to our "bigcodebench" benchmark slug (code generation).
 *
 * Uses batch-loaded in-memory matching with 4 strategies.
 *
 * Tier: 4 (weekly sync)
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

const HF_DATASET = "bigcode/bigcodebench-results";
const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";
const PAGE_LENGTH = 100;

// Known provider prefixes for slug matching
const PROVIDER_PREFIXES = [
  "anthropic-", "openai-", "google-", "meta-", "meta-llama-",
  "deepseek-", "deepseek-ai-", "mistralai-", "cohere-",
  "xai-", "amazon-", "microsoft-", "nvidia-", "alibaba-",
  "qwen-", "01-ai-", "tiiuae-", "bigcode-", "stabilityai-",
];

const adapter: DataSourceAdapter = {
  id: "bigcode-leaderboard",
  name: "BigCodeBench Results",
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

    const hfToken = process.env.HUGGINGFACE_API_TOKEN || ctx.secrets?.HUGGINGFACE_API_TOKEN || "";
    const fetchHeaders: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "AI-Market-Cap-Bot",
    };
    if (hfToken) fetchHeaders["Authorization"] = `Bearer ${hfToken}`;

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
          { headers: fetchHeaders, signal: ctx.signal },
          { signal: ctx.signal }
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            errors: [{
              message: `HF Datasets API returned ${res.status}: ${body.slice(0, 200)}`,
              context: "api_error",
            }],
            metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
          };
        }

        const json: HFRowsResponse = await res.json();
        totalRows = json.num_rows_total;
        for (const row of json.rows) allRows.push(row.row);
        offset += PAGE_LENGTH;
        if (json.rows.length === 0) break;
      }
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{
          message: `Failed to fetch BigCodeBench results: ${err instanceof Error ? err.message : String(err)}`,
          context: "network_error",
        }],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    if (allRows.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "BigCodeBench returned empty data", context: "empty_response" }],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    // Sort by "complete" score descending (primary code gen score)
    allRows.sort((a, b) => (Number(b["complete"]) || 0) - (Number(a["complete"]) || 0));

    const entries = allRows.slice(0, maxEntries);
    let recordsProcessed = 0;
    let recordsCreated = 0;

    // ── Batch model lookup ──
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
      const providerSlug = makeSlug(m.provider);
      if (m.slug.startsWith(providerSlug + "-")) {
        const withoutPrefix = m.slug.slice(providerSlug.length + 1);
        if (!slugToId.has(withoutPrefix)) slugToId.set(withoutPrefix, m.id);
      }
    }

    // Pre-load benchmark IDs
    const benchmarkIdCache = new Map<string, number | null>();
    const { data: allBenchmarks } = await sb.from("benchmarks").select("id, slug");
    for (const b of allBenchmarks ?? []) benchmarkIdCache.set(b.slug, b.id);

    function findModelId(rawName: string): string | null {
      // rawName is like "Magicoder-S-DS-6.7B" or "meta-llama/Llama-3.3-70B"
      const slug = makeSlug(rawName);
      const shortName = rawName.split("/").pop() ?? rawName;
      const shortSlug = makeSlug(shortName);

      // Strategy 1: Direct slug match
      if (slugToId.has(slug)) return slugToId.get(slug)!;
      if (slugToId.has(shortSlug)) return slugToId.get(shortSlug)!;

      // Strategy 2: Provider-prefixed slug
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

      // Strategy 4: Contained slug (endsWith)
      for (const [dbSlug, id] of slugToId) {
        if (dbSlug.endsWith("-" + slug) || dbSlug.endsWith("-" + shortSlug)) return id;
      }

      return null;
    }

    let matchedCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const rank = i + 1;

      const modelName = (row["model"] as string) ?? "";
      if (!modelName) continue;

      recordsProcessed++;

      const modelSlug = makeSlug(modelName);
      const modelId = findModelId(modelName);

      if (modelId) matchedCount++;

      // Build summary from complete and instruct scores
      const completeScore = row["complete"] as number | null;
      const instructScore = row["instruct"] as number | null;
      const summaryParts: string[] = [];
      if (completeScore != null && isFinite(completeScore)) {
        summaryParts.push(`Complete: ${completeScore.toFixed(1)}`);
      }
      if (instructScore != null && isFinite(instructScore)) {
        summaryParts.push(`Instruct: ${instructScore.toFixed(1)}`);
      }
      const size = row["size"] as number | null;
      if (size != null) summaryParts.push(`${size}B params`);

      // News entry
      const newsRecord = {
        source: "bigcode-leaderboard",
        source_id: `bigcode-${modelSlug}-${today}`,
        title: `${modelName} — BigCodeBench #${rank}`,
        related_model_ids: modelId ? [modelId] : [],
        summary: summaryParts.join(" | "),
        url: "https://huggingface.co/spaces/bigcode/bigcodebench-leaderboard",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: null,
        tags: ["benchmark", "bigcode", "code"],
        metadata: { rank, model_id: modelId ?? null },
      };

      const { error: newsError } = await sb
        .from("model_news")
        .upsert(newsRecord, { onConflict: "source,source_id" });

      if (newsError) {
        errors.push({ message: `News upsert for ${modelName}: ${newsError.message}` });
      }

      // Write benchmark_scores for matched models
      if (!modelId) continue;

      const benchmarkId = benchmarkIdCache.get("bigcodebench");
      if (!benchmarkId) continue;

      // Use "complete" score as the primary BigCodeBench score
      const value = completeScore;
      if (value == null || typeof value !== "number" || !isFinite(value)) continue;

      const normalizedScore = value > 1 ? value : value * 100;

      const { error: scoreError } = await sb
        .from("benchmark_scores")
        .upsert(
          {
            model_id: modelId,
            benchmark_id: benchmarkId,
            score: value,
            score_normalized: normalizedScore,
            model_version: "",
            source: "bigcode-leaderboard",
            evaluation_date: today,
          },
          { onConflict: "model_id,benchmark_id,model_version" }
        );

      if (scoreError) {
        errors.push({
          message: `benchmark_scores upsert for ${modelName}/bigcodebench: ${scoreError.message}`,
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
        source: "hf_datasets_api",
        dataset: HF_DATASET,
        totalRowsFetched: allRows.length,
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
        return { healthy: true, latencyMs, message: "HF Datasets API reachable for BigCodeBench" };
      }
      return { healthy: false, latencyMs, message: `HF Datasets API returned HTTP ${res.status}` };
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
