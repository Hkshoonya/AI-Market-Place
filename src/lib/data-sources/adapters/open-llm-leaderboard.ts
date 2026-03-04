import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug } from "../utils";

/**
 * Open LLM Leaderboard Adapter — HuggingFace Benchmark Rankings
 *
 * Fetches model benchmark scores from the Open LLM Leaderboard v2
 * via the HuggingFace Datasets Server API (open-llm-leaderboard/contents).
 *
 * Columns: fullname, Model, Average ⬆️, IFEval, BBH, MATH Lvl 5,
 *          GPQA, MUSR, MMLU-PRO, #Params (B), Type
 *
 * Uses batch-loaded in-memory matching with 4 strategies for
 * reliable model identification (LiveBench-style matching).
 *
 * Writes to both model_news (traceability) and benchmark_scores (structured).
 */

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

const HF_DATASET = "open-llm-leaderboard/contents";
const HF_ROWS_API = "https://datasets-server.huggingface.co/rows";
const PAGE_LENGTH = 100;

// ────────────────────────────────────────────────────────────────
// Benchmark field → slug mapping
// Maps column names from the leaderboard dataset → our benchmark slugs
// ────────────────────────────────────────────────────────────────

const BENCHMARK_FIELD_MAP: Record<string, string> = {
  IFEval: "ifeval",
  BBH: "bbh",
  "MATH Lvl 5": "math-benchmark",
  GPQA: "gpqa",
  MUSR: "musr",
  "MMLU-PRO": "mmlu-pro",
};

// Known provider prefixes for slug matching
const PROVIDER_PREFIXES = [
  "anthropic-", "openai-", "google-", "meta-", "meta-llama-",
  "deepseek-", "deepseek-ai-", "mistralai-", "cohere-",
  "xai-", "amazon-", "microsoft-", "nvidia-", "alibaba-",
  "qwen-", "01-ai-", "tiiuae-", "bigcode-", "stabilityai-",
];

/**
 * Normalize an Open LLM Leaderboard model name for matching.
 * HF names look like "meta-llama/Llama-3.3-70B-Instruct" or "Qwen/Qwen2.5-72B".
 * We strip HF org prefixes, date suffixes, and normalize for fuzzy matching.
 */
function normalizeHFName(fullname: string): {
  slug: string;
  shortName: string;
  orgSlug: string;
} {
  const parts = fullname.split("/");
  const org = parts.length > 1 ? parts[0] : "";
  const modelPart = parts.length > 1 ? parts.slice(1).join("/") : fullname;

  // Clean up: remove -Instruct, -Chat, -GGUF suffixes that aren't in our DB
  let cleaned = modelPart
    .replace(/-Instruct$/i, "")
    .replace(/-Chat$/i, "")
    .replace(/-GGUF$/i, "")
    .replace(/-hf$/i, "")
    .trim();

  const shortName = cleaned;
  const slug = makeSlug(cleaned);
  const orgSlug = makeSlug(org);

  return { slug, shortName, orgSlug };
}

const adapter: DataSourceAdapter = {
  id: "open-llm-leaderboard",
  name: "Open LLM Leaderboard",
  outputTypes: ["benchmarks"],
  defaultConfig: {
    maxEntries: 500,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxEntries = (ctx.config.maxEntries as number) ?? 200;
    const errors: { message: string; context?: string }[] = [];
    const sb = ctx.supabase;
    const today = new Date().toISOString().split("T")[0];

    // Use HF token from env for higher rate limits
    const hfToken = process.env.HUGGINGFACE_API_TOKEN || ctx.secrets?.HUGGINGFACE_API_TOKEN || "";
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "AI-Market-Cap-Bot",
    };
    if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

    // Fetch ALL rows from HF Datasets Server API with pagination
    // We need all rows first so we can sort by score and take the top entries.
    // The dataset has ~4500 entries; we fetch them all then pick the best.
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
          { headers, signal: ctx.signal },
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
                context: "api_error",
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
            message: `Failed to fetch leaderboard: ${err instanceof Error ? err.message : String(err)}`,
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
        errors: [{ message: "HF Datasets API returned empty data", context: "empty_response" }],
        metadata: { source: "hf_datasets_api", dataset: HF_DATASET },
      };
    }

    // Sort by average score descending for ranking
    allRows.sort((a, b) => {
      const avgA = (a["Average ⬆️"] as number) ?? 0;
      const avgB = (b["Average ⬆️"] as number) ?? 0;
      return avgB - avgA;
    });

    // Limit to maxEntries
    const entries = allRows.slice(0, maxEntries);
    const recordsProcessed = entries.length;
    let recordsCreated = 0;

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
      const providerSlug = makeSlug(m.provider);
      if (m.slug.startsWith(providerSlug + "-")) {
        const withoutPrefix = m.slug.slice(providerSlug.length + 1);
        if (!slugToId.has(withoutPrefix)) {
          slugToId.set(withoutPrefix, m.id);
        }
      }
    }

    // Build base-slug → dated-variant-IDs map
    const baseToDatedIds = new Map<string, string[]>();
    for (const m of allModels) {
      const dateMatch = m.slug.match(/^(.+)-\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) {
        const baseSlug = dateMatch[1];
        const existing = baseToDatedIds.get(baseSlug) ?? [];
        existing.push(m.id);
        baseToDatedIds.set(baseSlug, existing);
      }
    }

    // Pre-load benchmark ID lookup
    const { data: allBenchmarks } = await sb.from("benchmarks").select("id, slug");
    const benchmarkIdMap = new Map<string, number>();
    for (const b of allBenchmarks ?? []) {
      benchmarkIdMap.set(b.slug, b.id);
    }

    /**
     * Multi-strategy model matching (4 strategies):
     * 1. Direct slug match (full HF name → slug)
     * 2. Provider-prefixed slug match
     * 3. Fuzzy name match (hyphen→space, X-Y→X.Y)
     * 4. Contained slug match (endsWith)
     */
    function findModelId(fullname: string): string | null {
      const { slug, shortName, orgSlug } = normalizeHFName(fullname);
      const fullSlug = makeSlug(fullname); // e.g. "meta-llama-llama-3-3-70b-instruct"

      // Strategy 1: Direct slug match
      if (slugToId.has(fullSlug)) return slugToId.get(fullSlug)!;
      if (slugToId.has(slug)) return slugToId.get(slug)!;

      // Also try org-model format (e.g. "meta-llama-3-3-70b")
      if (orgSlug) {
        const orgModel = `${orgSlug}-${slug}`;
        if (slugToId.has(orgModel)) return slugToId.get(orgModel)!;
      }

      // Strategy 2: Try slug with known provider prefixes
      for (const prefix of PROVIDER_PREFIXES) {
        const prefixed = prefix + slug;
        if (slugToId.has(prefixed)) return slugToId.get(prefixed)!;
      }

      // Also try with -instruct suffix (some DB models keep it)
      const instructSlug = slug + "-instruct";
      if (slugToId.has(instructSlug)) return slugToId.get(instructSlug)!;
      for (const prefix of PROVIDER_PREFIXES) {
        if (slugToId.has(prefix + instructSlug)) return slugToId.get(prefix + instructSlug)!;
      }

      // Strategy 3: Fuzzy name match — convert hyphens to spaces/dots
      const nameWithSpaces = shortName.replace(/-/g, " ").toLowerCase();
      const nameWithDots = shortName
        .replace(/(\d)-(\d)/g, "$1.$2")
        .replace(/-/g, " ")
        .toLowerCase();

      for (const [dbName, id] of nameLowerToId) {
        if (dbName === nameWithSpaces || dbName === nameWithDots) {
          return id;
        }
        // Partial match — check if the DB name contains our normalized name
        if (dbName.includes(nameWithSpaces) || dbName.includes(nameWithDots)) {
          return id;
        }
      }

      // Strategy 4: Check if normalized slug is contained in any DB slug
      for (const [dbSlug, id] of slugToId) {
        if (dbSlug.endsWith("-" + slug) || dbSlug.endsWith("-" + instructSlug)) {
          return id;
        }
      }

      return null;
    }

    // Find all model IDs including dated variants
    function findAllModelIds(fullname: string): string[] {
      const primaryId = findModelId(fullname);
      if (!primaryId) return [];

      const ids = [primaryId];
      const matchedModel = allModels.find((m) => m.id === primaryId);
      if (matchedModel) {
        const datedIds = baseToDatedIds.get(matchedModel.slug) ?? [];
        for (const datedId of datedIds) {
          if (!ids.includes(datedId)) ids.push(datedId);
        }
      }

      return ids;
    }

    let matchedCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const rank = i + 1;

      // Model name — try fullname first, then Model column
      const fullname = (row["fullname"] as string) ?? (row["Model"] as string) ?? "";
      if (!fullname) continue;

      const modelSlug = makeSlug(fullname);
      const shortName = fullname.split("/").pop() ?? fullname;

      // Extract benchmark scores from the row
      const avgScore = (row["Average ⬆️"] as number) ?? null;
      const ifevalScore = (row["IFEval"] as number) ?? null;
      const bbhScore = (row["BBH"] as number) ?? null;
      const mathScore = (row["MATH Lvl 5"] as number) ?? null;
      const gpqaScore = (row["GPQA"] as number) ?? null;
      const musrScore = (row["MUSR"] as number) ?? null;
      const mmluProScore = (row["MMLU-PRO"] as number) ?? null;
      const paramsB = (row["#Params (B)"] as number) ?? null;
      const modelType = (row["Type"] as string) ?? (row["T"] as string) ?? null;

      // Multi-strategy model matching
      const allModelIds = findAllModelIds(fullname);
      const modelId = allModelIds.length > 0 ? allModelIds[0] : null;

      if (modelId) matchedCount++;

      // Store as news entry for traceability
      const benchmarkRecord = {
        source: "open-llm-leaderboard",
        source_id: `ollm-${modelSlug}-${today}`,
        title: `${fullname} — Open LLM Leaderboard #${rank}`,
        related_model_ids: modelId ? [modelId] : [],
        summary: [
          avgScore != null ? `Avg: ${avgScore.toFixed(1)}` : null,
          ifevalScore != null ? `IFEval: ${ifevalScore.toFixed(1)}` : null,
          bbhScore != null ? `BBH: ${bbhScore.toFixed(1)}` : null,
          mathScore != null ? `MATH: ${mathScore.toFixed(1)}` : null,
          gpqaScore != null ? `GPQA: ${gpqaScore.toFixed(1)}` : null,
          mmluProScore != null ? `MMLU-PRO: ${mmluProScore.toFixed(1)}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        url: "https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",
        published_at: new Date().toISOString(),
        category: "benchmark",
        related_provider: null,
        tags: ["benchmark", "open-llm-leaderboard", modelType ?? "unknown"].filter(Boolean),
        metadata: {
          rank,
          average_score: avgScore,
          ifeval_score: ifevalScore,
          bbh_score: bbhScore,
          math_score: mathScore,
          gpqa_score: gpqaScore,
          musr_score: musrScore,
          mmlu_pro_score: mmluProScore,
          parameters_b: paramsB,
          model_type: modelType,
          model_id: modelId ?? null,
        },
      };

      const { error } = await sb
        .from("model_news")
        .upsert(benchmarkRecord, { onConflict: "source,source_id" });

      if (error) {
        errors.push({
          message: `Leaderboard entry ${fullname}: ${error.message}`,
        });
      } else {
        recordsCreated++;
      }

      // ── Write structured benchmark_scores rows ──────────────────
      if (allModelIds.length === 0) continue;

      const benchmarkCandidates: Array<{ column: string; value: number | null }> = [
        { column: "IFEval", value: ifevalScore },
        { column: "BBH", value: bbhScore },
        { column: "MATH Lvl 5", value: mathScore },
        { column: "GPQA", value: gpqaScore },
        { column: "MUSR", value: musrScore },
        { column: "MMLU-PRO", value: mmluProScore },
      ];

      for (const { column, value } of benchmarkCandidates) {
        if (value == null || typeof value !== "number" || !isFinite(value)) continue;

        const benchmarkSlug = BENCHMARK_FIELD_MAP[column];
        if (!benchmarkSlug) continue;

        const benchmarkRowId = benchmarkIdMap.get(benchmarkSlug);
        if (!benchmarkRowId) continue;

        // Normalize: if value > 1 treat as 0-100 scale already
        const normalizedScore = value > 1 ? value : value * 100;

        // Write to ALL matched models (primary + dated variants)
        for (const targetModelId of allModelIds) {
          const scoreRecord = {
            model_id: targetModelId,
            benchmark_id: benchmarkRowId,
            score: value,
            score_normalized: normalizedScore,
            model_version: "",
            source: "open-llm-leaderboard",
            evaluation_date: new Date().toISOString().split("T")[0],
          };

          const { error: scoreError } = await sb
            .from("benchmark_scores")
            .upsert(scoreRecord, {
              onConflict: "model_id,benchmark_id,model_version",
            });

          if (scoreError) {
            errors.push({
              message: `benchmark_scores upsert for ${fullname}/${benchmarkSlug}: ${scoreError.message}`,
            });
          }
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
        topModel: entries[0]?.["fullname"] ?? null,
        matchedModels: matchedCount,
        totalEntries: entries.length,
        matchRate: `${((matchedCount / Math.max(entries.length, 1)) * 100).toFixed(1)}%`,
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
          message: "HF Datasets API reachable for Open LLM Leaderboard",
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
