/**
 * Open VLM Leaderboard Adapter - Vision/Multimodal Benchmarks
 *
 * Fetches model benchmark scores from the Open VLM leaderboard's published
 * JSON snapshot on OpenXLab. The older Hugging Face dataset endpoint used by
 * this adapter is no longer reliable for production syncs.
 *
 * Provides multimodal benchmarks (MMMU, MathVista, OCRBench, MME, AI2D,
 * MMStar, HallusionBench, MMBench) that fill a critical gap for image/VLM
 * models in the site.
 */

import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import {
  buildModelAliasIndex,
  fetchAllActiveAliasModels,
  resolveAliasFamilyModelIds,
} from "../model-alias-resolver";
import { registerAdapter } from "../registry";
import { fetchWithRetry, isPermanentHttpFailure, makeSlug } from "../utils";

interface OpenVlmLeaderboardResponse {
  time?: string;
  results?: Record<string, OpenVlmEntry>;
}

interface OpenVlmEntry {
  META?: {
    Method?: unknown;
    Time?: string;
    Org?: string;
    key?: number;
    dir_name?: string;
  };
  [benchmark: string]: unknown;
}

interface ExtractedBenchmarkScore {
  benchmarkSlug: string;
  sourceKey: string;
  score: number;
  normalizedScore: number;
}

interface BenchmarkExtractor {
  sourceKeys: readonly string[];
  benchmarkSlug: string;
  preferredFields?: readonly string[];
}

const OPENVLM_JSON_URL = "https://opencompass.openxlab.space/assets/OpenVLM.json";
const OPENVLM_PAGE_URL = "https://huggingface.co/spaces/opencompass/open_vlm_leaderboard";

const PROVIDER_PREFIXES = [
  "anthropic-", "openai-", "google-", "meta-", "meta-llama-",
  "deepseek-", "deepseek-ai-", "mistralai-", "cohere-",
  "xai-", "amazon-", "microsoft-", "nvidia-", "alibaba-",
  "qwen-", "01-ai-", "tiiuae-", "bigcode-", "stabilityai-",
];

const BENCHMARK_EXTRACTORS: readonly BenchmarkExtractor[] = [
  { sourceKeys: ["MMMU_VAL", "MMMU"], benchmarkSlug: "mmmu" },
  { sourceKeys: ["MathVista", "MathVista_MINI"], benchmarkSlug: "mathvista" },
  { sourceKeys: ["OCRBench"], benchmarkSlug: "ocrbench", preferredFields: ["Final Score Norm", "Final Score", "Overall"] },
  { sourceKeys: ["MMBench_TEST_EN_V11", "MMBench_TEST_EN", "MMBench_TEST_CN_V11", "MMBench_TEST_CN", "MMBench_V11", "MMBench"], benchmarkSlug: "mmbench" },
  { sourceKeys: ["MME"], benchmarkSlug: "mme" },
  { sourceKeys: ["AI2D"], benchmarkSlug: "ai2d" },
  { sourceKeys: ["MMStar"], benchmarkSlug: "mmstar" },
  { sourceKeys: ["HallusionBench"], benchmarkSlug: "hallusionbench" },
];

function readNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getSectionScore(
  section: unknown,
  preferredFields: readonly string[] = ["Overall", "Final Score Norm", "Final Score"]
): number | null {
  if (!section || typeof section !== "object") return null;

  const record = section as Record<string, unknown>;
  for (const field of preferredFields) {
    const value = readNumericValue(record[field]);
    if (value != null) return value;
  }

  return null;
}

function normalizeScore(benchmarkSlug: string, rawScore: number): number {
  if (benchmarkSlug === "ocrbench" && rawScore > 100) {
    return Math.min(100, rawScore / 10);
  }

  if (benchmarkSlug === "mme" && rawScore > 100) {
    return Math.min(100, rawScore / 28);
  }

  if (rawScore <= 1) {
    return rawScore * 100;
  }

  return rawScore;
}

function extractBenchmarkScores(entry: OpenVlmEntry): ExtractedBenchmarkScore[] {
  const scores: ExtractedBenchmarkScore[] = [];

  for (const extractor of BENCHMARK_EXTRACTORS) {
    for (const sourceKey of extractor.sourceKeys) {
      const rawScore = getSectionScore(entry[sourceKey], extractor.preferredFields);
      if (rawScore == null) continue;

      scores.push({
        benchmarkSlug: extractor.benchmarkSlug,
        sourceKey,
        score: rawScore,
        normalizedScore: normalizeScore(extractor.benchmarkSlug, rawScore),
      });
      break;
    }
  }

  return scores;
}

function getMethodName(entryKey: string, entry: OpenVlmEntry): string {
  const method = entry.META?.Method;
  if (Array.isArray(method) && typeof method[0] === "string" && method[0].trim()) {
    return method[0];
  }
  return entryKey;
}

function getMethodUrl(entry: OpenVlmEntry): string | null {
  const method = entry.META?.Method;
  if (Array.isArray(method) && typeof method[1] === "string" && method[1].trim()) {
    return method[1];
  }
  return null;
}

function parsePublishedAt(rawTime: string | undefined): string {
  if (rawTime && /^\d{4}\/\d{2}\/\d{2}$/.test(rawTime)) {
    return new Date(`${rawTime.replace(/\//g, "-")}T00:00:00.000Z`).toISOString();
  }
  return new Date().toISOString();
}

export const __testables = {
  extractBenchmarkScores,
  normalizeScore,
};

const adapter: DataSourceAdapter = {
  id: "open-vlm-leaderboard",
  name: "Open VLM Leaderboard",
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

    let payload: OpenVlmLeaderboardResponse;

    try {
      const res = await fetchWithRetry(
        OPENVLM_JSON_URL,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "AI-Market-Cap-Bot",
          },
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
          errors: [{
            message: `Open VLM JSON feed returned ${res.status}: ${body.slice(0, 200)}`,
            context: isPermanentHttpFailure(res.status, body) ? "permanent_upstream_failure" : "api_error",
          }],
          metadata: { source: "openxlab_json", url: OPENVLM_JSON_URL },
        };
      }

      payload = await res.json() as OpenVlmLeaderboardResponse;
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{
          message: `Failed to fetch Open VLM Leaderboard: ${err instanceof Error ? err.message : String(err)}`,
          context: "network_error",
        }],
        metadata: { source: "openxlab_json", url: OPENVLM_JSON_URL },
      };
    }

    const rawEntries = Object.entries(payload.results ?? {}).map(([entryKey, entry]) => {
      const extractedScores = extractBenchmarkScores(entry);
      const averageNormalizedScore =
        extractedScores.reduce((sum, item) => sum + item.normalizedScore, 0) /
        Math.max(extractedScores.length, 1);

      return {
        entryKey,
        entry,
        modelName: getMethodName(entryKey, entry),
        sourceUrl: getMethodUrl(entry),
        publishedAt: parsePublishedAt(entry.META?.Time),
        extractedScores,
        averageNormalizedScore,
      };
    }).filter((item) => item.extractedScores.length > 0);

    if (rawEntries.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{
          message: "Open VLM Leaderboard returned no usable benchmark rows",
          context: "empty_response",
        }],
        metadata: { source: "openxlab_json", url: OPENVLM_JSON_URL },
      };
    }

    rawEntries.sort((a, b) => b.averageNormalizedScore - a.averageNormalizedScore);
    const entries = rawEntries.slice(0, maxEntries);

    const allModels = await fetchAllActiveAliasModels(sb);
    const modelAliasIndex = buildModelAliasIndex(allModels);

    const slugToId = new Map<string, string>();
    const nameLowerToId = new Map<string, string>();

    for (const model of allModels) {
      slugToId.set(model.slug, model.id);
      nameLowerToId.set(model.name.toLowerCase(), model.id);
      const providerSlug = makeSlug(model.provider);
      if (model.slug.startsWith(providerSlug + "-")) {
        const withoutPrefix = model.slug.slice(providerSlug.length + 1);
        if (!slugToId.has(withoutPrefix)) slugToId.set(withoutPrefix, model.id);
      }
    }

    const benchmarkIdCache = new Map<string, number | null>();
    const { data: allBenchmarks } = await sb.from("benchmarks").select("id, slug");
    for (const benchmark of allBenchmarks ?? []) {
      benchmarkIdCache.set(benchmark.slug, benchmark.id);
    }

    function findModelId(rawName: string): string | null {
      const slug = makeSlug(rawName);
      const shortName = rawName.split("/").pop() ?? rawName;
      const shortSlug = makeSlug(shortName);

      if (slugToId.has(slug)) return slugToId.get(slug)!;
      if (slugToId.has(shortSlug)) return slugToId.get(shortSlug)!;

      for (const prefix of PROVIDER_PREFIXES) {
        if (slugToId.has(prefix + slug)) return slugToId.get(prefix + slug)!;
        if (slugToId.has(prefix + shortSlug)) return slugToId.get(prefix + shortSlug)!;
      }

      const nameWithSpaces = shortName.replace(/-/g, " ").toLowerCase();
      const nameWithDots = shortName
        .replace(/(\d)-(\d)/g, "$1.$2")
        .replace(/-/g, " ")
        .toLowerCase();

      for (const [dbName, id] of nameLowerToId) {
        if (dbName === nameWithSpaces || dbName === nameWithDots) return id;
        if (dbName.includes(nameWithSpaces) || dbName.includes(nameWithDots)) return id;
      }

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

    let recordsProcessed = 0;
    let recordsCreated = 0;
    let matchedCount = 0;

    for (let index = 0; index < entries.length; index++) {
      const item = entries[index];
      const rank = index + 1;
      const modelName = item.modelName;
      const modelSlug = makeSlug(modelName);
      const allModelIds = findAllModelIds(modelName);
      const modelId = allModelIds[0] ?? null;

      recordsProcessed++;
      if (allModelIds.length > 0) matchedCount++;

      const newsRecord = {
        source: "open-vlm-leaderboard",
        source_id: `vlm-${modelSlug}-${today}`,
        title: `${modelName} - Open VLM Leaderboard #${rank}`,
        related_model_ids: modelId ? [modelId] : [],
        summary: item.extractedScores
          .map((score) => `${score.sourceKey}: ${score.normalizedScore.toFixed(1)}`)
          .join(" | "),
        url: item.sourceUrl ?? OPENVLM_PAGE_URL,
        published_at: item.publishedAt,
        category: "benchmark",
        related_provider: null,
        tags: ["benchmark", "vlm", "vision", "multimodal"],
        metadata: {
          rank,
          model_id: modelId ?? null,
          source_time: payload.time ?? null,
          benchmark_count: item.extractedScores.length,
        },
      };

      const { error: newsError } = await sb
        .from("model_news")
        .upsert(newsRecord, { onConflict: "source,source_id" });

      if (newsError) {
        errors.push({ message: `News upsert for ${modelName}: ${newsError.message}` });
      }

      if (allModelIds.length === 0) continue;

      for (const extractedScore of item.extractedScores) {
        const benchmarkId = benchmarkIdCache.get(extractedScore.benchmarkSlug);
        if (!benchmarkId) continue;

        for (const targetModelId of allModelIds) {
          const { error: scoreError } = await sb
            .from("benchmark_scores")
            .upsert(
              {
                model_id: targetModelId,
                benchmark_id: benchmarkId,
                score: extractedScore.score,
                score_normalized: extractedScore.normalizedScore,
                model_version: "",
                source: "open-vlm-leaderboard",
                evaluation_date: today,
              },
              { onConflict: "model_id,benchmark_id,model_version" }
            );

          if (scoreError) {
            errors.push({
              message: `benchmark_scores upsert for ${modelName}/${extractedScore.benchmarkSlug}: ${scoreError.message}`,
            });
          } else {
            recordsCreated++;
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
        source: "openxlab_json",
        url: OPENVLM_JSON_URL,
        totalRowsFetched: rawEntries.length,
        matchedModels: matchedCount,
        matchRateScope: "broad_public_leaderboard",
        sourceTime: payload.time ?? null,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        OPENVLM_JSON_URL,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "AI-Market-Cap-Bot",
          },
        },
        { maxRetries: 1 }
      );
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          healthy: true,
          latencyMs,
          message: "Open VLM JSON feed reachable",
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `Open VLM JSON feed returned HTTP ${res.status}`,
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
