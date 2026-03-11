/**
 * LiveBench Adapter — Multi-Category AI Model Benchmarks
 *
 * Fetches per-question model judgment scores from the LiveBench dataset
 * (livebench/model_judgment) on HuggingFace Datasets Server API.
 *
 * LiveBench covers BOTH proprietary (GPT-4.1, Claude 4, Gemini 2.5, o3, etc.)
 * and open-weight models across 6 benchmark categories:
 *   reasoning, math, coding, language, if (instruction-following), data_analysis
 *
 * Per-question scores are aggregated into per-model per-category averages,
 * then written to benchmark_scores with source="livebench".
 *
 * This is the HIGHEST IMPACT adapter because it fills benchmark gaps for
 * 700+ models that were previously capped at quality_score 50.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug } from "../utils";
// REMOVED: import { sanitizeFilterValue, sanitizeSlug } from "@/lib/utils/sanitize";

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

const HF_DATASET = "livebench/model_judgment";
const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";
const HF_SPLIT = "leaderboard";
const PAGE_LENGTH = 100;

/**
 * Map LiveBench category names to our benchmark slugs.
 * The dataset uses lowercase category names like "reasoning", "math", etc.
 */
const CATEGORY_TO_BENCHMARK_SLUG: Record<string, string> = {
  reasoning: "livebench-reasoning",
  math: "livebench-math",
  coding: "livebench-coding",
  language: "livebench-language",
  if: "livebench-if",
  instruction_following: "livebench-if",
  "instruction-following": "livebench-if",
  data_analysis: "livebench-data-analysis",
  "data-analysis": "livebench-data-analysis",
};

/**
 * Normalize LiveBench model names to match our slugs.
 * LiveBench uses names like "chatgpt-4o-latest-2025-01-29",
 * "amazon.nova-lite-v1:0", "claude-3-5-sonnet-20241022", etc.
 *
 * We strip date suffixes, version suffixes, and provider prefixes.
 */
function normalizeModelName(name: string): {
  slug: string;
  shortName: string;
} {
  const cleaned = name
    // Remove date suffixes like -20241022, -2025-01-29
    .replace(/-\d{8}$/, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")
    // Remove AWS-style suffixes like :0
    .replace(/:\d+$/, "")
    // Remove provider prefixes like amazon. or google.
    .replace(/^(amazon|google|meta|microsoft|alibaba)\./i, "")
    // Remove "-latest" suffix
    .replace(/-latest$/, "")
    .trim();

  // Generate a short display name (last segment after /)
  const shortName = cleaned.split("/").pop() ?? cleaned;
  const slug = makeSlug(cleaned);

  return { slug, shortName };
}

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "livebench",
  name: "LiveBench",
  outputTypes: ["benchmarks"],
  defaultConfig: {
    maxRows: 15000, // Sampled: ~100 pages × 100 rows = ~10K rows across all categories
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    // Sample ~10K rows from evenly-spaced offsets across the 60K-row dataset.
    // This covers all categories while making only ~100 API requests.
    const maxRows = (ctx.config.maxRows as number) ?? 15000;
    const errors: { message: string; context?: string }[] = [];
    const sb = ctx.supabase;

    // ────────────────────────────────────────────────────────────────
    // 1. Fetch raw per-question scores from HF Datasets API
    // ────────────────────────────────────────────────────────────────
    const allRows: HFRowContent[] = [];
    // REMOVED: const offset = 0;
    let totalRows = Infinity;

    // Use HF token from env for higher rate limits
    const hfToken = process.env.HUGGINGFACE_API_TOKEN || ctx.secrets?.HUGGINGFACE_API_TOKEN || "";
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "AI-Market-Cap-Bot",
    };
    if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

    // ── Sampling strategy ──
    // The dataset is sorted by category (language ~0-35K, coding ~35K-53K,
    // instruction_following ~53K-60K). Fetching all 60K rows triggers 429s.
    // Instead, we sample from evenly-spaced offsets across the dataset,
    // fetching 5 pages (500 rows) at each sample point. This covers all
    // categories and models while making only ~100 requests total.
    const SAMPLE_POINTS = 20; // 20 sample points across the dataset
    const PAGES_PER_SAMPLE = 5; // 5 pages of 100 rows = 500 rows per sample
    const seenCategories = new Set<string>();

    try {
      // First, get the total row count from a single request
      const probeUrl = new URL(HF_ROWS_API);
      probeUrl.searchParams.set("dataset", HF_DATASET);
      probeUrl.searchParams.set("config", "default");
      probeUrl.searchParams.set("split", HF_SPLIT);
      probeUrl.searchParams.set("offset", "0");
      probeUrl.searchParams.set("length", "1");

      const probeRes = await fetchWithRetry(
        probeUrl.toString(),
        { headers, signal: ctx.signal },
        { signal: ctx.signal, maxRetries: 5, baseDelayMs: 2000 }
      );
      if (!probeRes.ok) {
        const body = await probeRes.text().catch(() => "");
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{
            message: `HF Datasets API returned ${probeRes.status}: ${body.slice(0, 200)}`,
            context: "api_error",
          }],
          metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
        };
      }
      const probeJson: HFRowsResponse = await probeRes.json();
      totalRows = probeJson.num_rows_total;

      // Calculate sample offsets spread evenly across the dataset
      const step = Math.floor(totalRows / SAMPLE_POINTS);
      const sampleOffsets: number[] = [];
      for (let i = 0; i < SAMPLE_POINTS; i++) {
        const baseOffset = i * step;
        for (let p = 0; p < PAGES_PER_SAMPLE; p++) {
          const pageOffset = baseOffset + p * PAGE_LENGTH;
          if (pageOffset < totalRows) {
            sampleOffsets.push(pageOffset);
          }
        }
      }

      // Fetch all sample pages with rate limiting
      for (const sampleOffset of sampleOffsets) {
        if (allRows.length >= maxRows) break;

        const url = new URL(HF_ROWS_API);
        url.searchParams.set("dataset", HF_DATASET);
        url.searchParams.set("config", "default");
        url.searchParams.set("split", HF_SPLIT);
        url.searchParams.set("offset", String(sampleOffset));
        url.searchParams.set("length", String(PAGE_LENGTH));

        const res = await fetchWithRetry(
          url.toString(),
          { headers, signal: ctx.signal },
          { signal: ctx.signal, maxRetries: 5, baseDelayMs: 2000 }
        );

        if (!res.ok) {
          // Skip individual page errors — we'll have enough data from other samples
          continue;
        }

        const json: HFRowsResponse = await res.json();
        for (const row of json.rows) {
          allRows.push(row.row);
          const category = String(row.row.category ?? "").toLowerCase().trim();
          if (category) seenCategories.add(category);
        }

        if (json.rows.length === 0) continue;

        // Rate limit: 300ms delay between requests to be extra safe
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch LiveBench: ${err instanceof Error ? err.message : String(err)}`,
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
        errors: [{ message: "LiveBench dataset returned empty data", context: "empty_response" }],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    // ────────────────────────────────────────────────────────────────
    // 2. Aggregate per-question scores → per-model per-category avg
    // ────────────────────────────────────────────────────────────────
    // Key: "modelName::category" → array of scores
    const scoreMap = new Map<string, number[]>();
    const modelCategories = new Map<string, Set<string>>();

    for (const row of allRows) {
      const modelName = (row["model"] as string) ?? (row["Model"] as string);
      const score = row["score"] as number | null;
      const category = (
        (row["category"] as string) ??
        (row["Category"] as string) ??
        ""
      ).toLowerCase().trim();

      if (!modelName || score == null || !category) continue;

      const key = `${modelName}::${category}`;
      if (!scoreMap.has(key)) scoreMap.set(key, []);
      scoreMap.get(key)!.push(score);

      if (!modelCategories.has(modelName)) modelCategories.set(modelName, new Set());
      modelCategories.get(modelName)!.add(category);
    }

    // Compute averages
    const modelCategoryAvgs = new Map<string, Map<string, number>>();
    for (const [key, scores] of scoreMap) {
      const [modelName, category] = key.split("::");
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

      if (!modelCategoryAvgs.has(modelName)) modelCategoryAvgs.set(modelName, new Map());
      modelCategoryAvgs.get(modelName)!.set(category, avg);
    }

    // ────────────────────────────────────────────────────────────────
    // 3. Match models and write benchmark_scores
    // ────────────────────────────────────────────────────────────────
    let recordsProcessed = 0;
    let recordsCreated = 0;

    // Cache benchmark row lookups
    const benchmarkIdCache = new Map<string, number | null>();

    async function getBenchmarkId(slug: string): Promise<number | null> {
      if (benchmarkIdCache.has(slug)) return benchmarkIdCache.get(slug)!;
      const { data } = await sb
        .from("benchmarks")
        .select("id")
        .eq("slug", slug)
        .limit(1);
      const id = data?.[0]?.id ?? null;
      benchmarkIdCache.set(slug, id);
      return id;
    }

    // ── Batch model lookup for efficient matching ──
    // Fetch ALL active models once, then match in-memory
    const { data: allModelsRaw } = await sb
      .from("models")
      .select("id, slug, name, provider")
      .eq("status", "active");
    const allModels = (allModelsRaw ?? []) as {
      id: string;
      slug: string;
      name: string;
      provider: string;
    }[];

    // Build multiple lookup indexes for flexible matching
    const slugToId = new Map<string, string>();
    const nameLowerToId = new Map<string, string>();

    for (const m of allModels) {
      slugToId.set(m.slug, m.id);
      nameLowerToId.set(m.name.toLowerCase(), m.id);

      // Also index by slug without provider prefix
      // e.g., "anthropic-claude-3-5-sonnet" → "claude-3-5-sonnet"
      const providerSlug = makeSlug(m.provider);
      if (m.slug.startsWith(providerSlug + "-")) {
        const withoutPrefix = m.slug.slice(providerSlug.length + 1);
        if (!slugToId.has(withoutPrefix)) {
          slugToId.set(withoutPrefix, m.id);
        }
      }
    }

    // Known provider prefixes for slug matching
    const PROVIDER_PREFIXES = [
      "anthropic-", "openai-", "google-", "meta-",
      "deepseek-", "deepseek-ai-", "mistralai-", "cohere-",
      "xai-", "amazon-", "microsoft-", "nvidia-",
    ];

    function findModelId(rawName: string): string | null {
      const { slug, shortName } = normalizeModelName(rawName);

      // Strategy 1: Direct slug match (handles "deepseek-r1" → "deepseek-r1")
      if (slugToId.has(slug)) return slugToId.get(slug)!;

      // Strategy 2: Try slug with provider prefixes
      // "claude-3-5-sonnet" → "anthropic-claude-3-5-sonnet"
      for (const prefix of PROVIDER_PREFIXES) {
        const prefixed = prefix + slug;
        if (slugToId.has(prefixed)) return slugToId.get(prefixed)!;
      }

      // Strategy 3: Fuzzy name match — convert hyphens to spaces/dots
      // "claude-3-5-sonnet" → "claude 3.5 sonnet" or "claude 3 5 sonnet"
      const nameWithSpaces = shortName.replace(/-/g, " ").toLowerCase();
      // Also try converting X-Y patterns to X.Y (e.g., "3-5" → "3.5")
      const nameWithDots = shortName
        .replace(/(\d)-(\d)/g, "$1.$2")
        .replace(/-/g, " ")
        .toLowerCase();

      for (const [dbName, id] of nameLowerToId) {
        if (dbName.includes(nameWithSpaces) || dbName.includes(nameWithDots)) {
          return id;
        }
      }

      // Strategy 4: Check if normalized slug is contained in any DB slug
      for (const [dbSlug, id] of slugToId) {
        if (dbSlug.endsWith("-" + slug) || dbSlug === slug) {
          return id;
        }
      }

      return null;
    }

    // Build a map of base slug → all dated variant IDs
    // e.g., "openai-o3" → ["id-of-openai-o3-2025-04-16", ...]
    const baseToDatedIds = new Map<string, string[]>();
    for (const m of allModels) {
      // Check if this model has a date suffix (YYYY-MM-DD)
      const dateMatch = m.slug.match(/^(.+)-\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) {
        const baseSlug = dateMatch[1];
        const existing = baseToDatedIds.get(baseSlug) ?? [];
        existing.push(m.id);
        baseToDatedIds.set(baseSlug, existing);
      }
    }

    // Find all model IDs that should receive scores for a given match
    // Returns the primary match + any dated variants
    function findAllModelIds(rawName: string): string[] {
      const primaryId = findModelId(rawName);
      if (!primaryId) return [];

      const ids = [primaryId];

      // Find the slug of the matched model
      const matchedModel = allModels.find((m) => m.id === primaryId);
      if (matchedModel) {
        // Check if there are dated variants of this model
        const datedIds = baseToDatedIds.get(matchedModel.slug) ?? [];
        for (const datedId of datedIds) {
          if (!ids.includes(datedId)) ids.push(datedId);
        }

        // Also check if WE are the base of a dated variant via provider-prefixed slug
        const providerSlug = makeSlug(matchedModel.provider);
        if (matchedModel.slug.startsWith(providerSlug + "-")) {
          const fullSlug = matchedModel.slug;
          const datedIdsForFull = baseToDatedIds.get(fullSlug) ?? [];
          for (const datedId of datedIdsForFull) {
            if (!ids.includes(datedId)) ids.push(datedId);
          }
        }
      }

      return ids;
    }

    for (const [modelName, categoryScores] of modelCategoryAvgs) {
      recordsProcessed++;
      const allModelIds = findAllModelIds(modelName);
      const { slug, shortName } = normalizeModelName(modelName);

      if (allModelIds.length === 0) continue;
      const modelId = allModelIds[0]; // primary match for news entry

      // Compute overall average across all categories for this model
      const allScores = Array.from(categoryScores.values());
      const overallAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;

      // Write per-category benchmark scores to ALL matched models (base + dated variants)
      for (const [category, avgScore] of categoryScores) {
        const benchmarkSlug = CATEGORY_TO_BENCHMARK_SLUG[category];
        if (!benchmarkSlug) continue;

        const benchmarkId = await getBenchmarkId(benchmarkSlug);
        if (!benchmarkId) continue;

        // LiveBench scores are typically 0-100 scale
        const normalizedScore = avgScore > 1 ? avgScore : avgScore * 100;

        for (const targetModelId of allModelIds) {
          const scoreRecord = {
            model_id: targetModelId,
            benchmark_id: benchmarkId,
            score: avgScore,
            score_normalized: normalizedScore,
            model_version: "",
            source: "livebench",
            evaluation_date: new Date().toISOString().split("T")[0],
          };

          const { error } = await sb
            .from("benchmark_scores")
            .upsert(scoreRecord, {
              onConflict: "model_id,benchmark_id,model_version",
            });

          if (error) {
            errors.push({
              message: `benchmark_scores upsert for ${modelName}/${benchmarkSlug}: ${error.message}`,
            });
          } else {
            recordsCreated++;
          }
        }
      }

      // Also write as news entry for traceability
      const today = new Date().toISOString().split("T")[0];
      const summaryParts: string[] = [];
      for (const [cat, score] of categoryScores) {
        summaryParts.push(`${cat}: ${score.toFixed(1)}`);
      }
      summaryParts.push(`Overall: ${overallAvg.toFixed(1)}`);

      const newsRecord = {
        source: "livebench",
        source_id: `livebench-${slug}-${today}`,
        title: `${shortName} — LiveBench Scores`,
        related_model_ids: [modelId],
        summary: summaryParts.join(" | "),
        url: "https://livebench.ai",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: null,
        tags: ["benchmark", "livebench"],
        metadata: {
          model_name: modelName,
          overall_average: overallAvg,
          category_scores: Object.fromEntries(categoryScores),
          model_id: modelId,
        },
      };

      try {
        await sb
          .from("model_news")
          .upsert(newsRecord, { onConflict: "source,source_id" });
      } catch {
        /* non-critical — news insert failure shouldn't block benchmark sync */
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
        split: HF_SPLIT,
        totalRowsFetched: allRows.length,
        uniqueModels: modelCategoryAvgs.size,
        categoriesFound: [...new Set(
          Array.from(scoreMap.keys()).map(k => k.split("::")[1])
        )],
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const url = new URL(HF_ROWS_API);
      url.searchParams.set("dataset", HF_DATASET);
      url.searchParams.set("config", "default");
      url.searchParams.set("split", HF_SPLIT);
      url.searchParams.set("offset", "0");
      url.searchParams.set("length", "1");

      const res = await fetchWithRetry(url.toString(), {}, { maxRetries: 1 });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          healthy: true,
          latencyMs,
          message: "HF Datasets API reachable for LiveBench",
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
