/**
 * GAIA Benchmark Adapter - official public leaderboard ingestion
 *
 * GAIA publishes public results on Hugging Face under
 * `gaia-benchmark/results_public`. The rows are agent-system submissions, so
 * this adapter only maps rows whose `model_family` cleanly identifies a single
 * underlying model family. Composite and generic provider-family labels are skipped.
 */

import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncError,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry } from "../utils";
import {
  buildModelAliasIndex,
  resolveMatchedAliasFamilyModelIds,
} from "../model-alias-resolver";
import {
  STATIC_BENCHMARK_ON_CONFLICT,
  buildStaticBenchmarkScoreRecord,
} from "./static-benchmark";

interface GaiaRow {
  model?: unknown;
  model_family?: unknown;
  url?: unknown;
  organisation?: unknown;
  score?: unknown;
  score_level1?: unknown;
  score_level2?: unknown;
  score_level3?: unknown;
  date?: unknown;
}

interface GaiaRowsResponse {
  rows?: Array<{ row?: GaiaRow }>;
  num_rows_total?: number;
}

interface GaiaCandidateScore {
  family: string;
  score: number;
  normalizedScore: number;
  date: string | null;
  submissionName: string;
  url: string | null;
  organisation: string | null;
  levelBreakdown: {
    level1: number | null;
    level2: number | null;
    level3: number | null;
  };
}

const GAIA_DATASET = "gaia-benchmark/results_public";
const GAIA_CONFIG = "2023";
const DATASET_ROWS_URL = "https://datasets-server.huggingface.co/rows";
const GAIA_DATASET_URL = "https://huggingface.co/datasets/gaia-benchmark/results_public";
const GAIA_SPLITS = ["validation", "test"] as const;
const PAGE_LENGTH = 100;
const GENERIC_FAMILY_LABELS = new Set([
  "gpt",
  "claude",
  "gemini",
  "llama",
  "qwen",
  "deepseek",
  "grok",
  "kimi",
  "mistral",
  "glm",
  "doubao",
  "qwq",
]);

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
}

function isCompositeFamily(family: string): boolean {
  const lower = family.toLowerCase();
  return (
    lower.includes(",") ||
    lower.includes(" + ") ||
    lower.includes("|") ||
    lower.includes(" and ") ||
    lower.includes("/") ||
    lower.includes("agent") ||
    lower.includes("autogpt")
  );
}

function looksLikeTrackableFamily(family: string): boolean {
  const lower = family.toLowerCase();
  const normalized = lower.replace(/[^a-z0-9]+/g, " ").trim();

  if (GENERIC_FAMILY_LABELS.has(normalized)) {
    return false;
  }

  return [
    "gpt",
    "claude",
    "gemini",
    "llama",
    "qwen",
    "deepseek",
    "grok",
    "kimi",
    "mistral",
    "o1",
    "o3",
    "o4",
    "glm",
    "doubao",
    "qwq",
  ].some((token) => lower.includes(token));
}

function toCandidateScore(row: GaiaRow): GaiaCandidateScore | null {
  const family = toNullableString(row.model_family);
  const submissionName = toNullableString(row.model);
  const score = toNumber(row.score);

  if (!family || !submissionName || score == null) return null;
  if (isCompositeFamily(family)) return null;

  return {
    family,
    score,
    normalizedScore: score <= 1 ? score * 100 : score,
    date: normalizeDate(row.date),
    submissionName,
    url: toNullableString(row.url),
    organisation: toNullableString(row.organisation),
    levelBreakdown: {
      level1: toNumber(row.score_level1),
      level2: toNumber(row.score_level2),
      level3: toNumber(row.score_level3),
    },
  };
}

function shouldReplaceCandidate(
  current: GaiaCandidateScore | undefined,
  next: GaiaCandidateScore
): boolean {
  if (!current) return true;
  if (next.normalizedScore !== current.normalizedScore) {
    return next.normalizedScore > current.normalizedScore;
  }
  if (next.date && current.date) {
    return next.date > current.date;
  }
  return Boolean(next.date && !current.date);
}

function extractCandidateScores(rows: GaiaRow[]): GaiaCandidateScore[] {
  const bestByFamily = new Map<string, GaiaCandidateScore>();

  for (const row of rows) {
    const candidate = toCandidateScore(row);
    if (!candidate) continue;

    const key = candidate.family.toLowerCase();
    const current = bestByFamily.get(key);
    if (shouldReplaceCandidate(current, candidate)) {
      bestByFamily.set(key, candidate);
    }
  }

  return Array.from(bestByFamily.values()).sort(
    (left, right) => right.normalizedScore - left.normalizedScore
  );
}

async function fetchSplitRows(
  split: (typeof GAIA_SPLITS)[number],
  signal?: AbortSignal
): Promise<GaiaRow[]> {
  const rows: GaiaRow[] = [];
  let offset = 0;
  let totalRows = Infinity;

  while (offset < totalRows) {
    const url = new URL(DATASET_ROWS_URL);
    url.searchParams.set("dataset", GAIA_DATASET);
    url.searchParams.set("config", GAIA_CONFIG);
    url.searchParams.set("split", split);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("length", String(PAGE_LENGTH));

    const res = await fetchWithRetry(
      url.toString(),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "AI-Market-Cap-Bot",
        },
        signal,
      },
      { signal }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GAIA ${split} returned HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as GaiaRowsResponse;
    totalRows = json.num_rows_total ?? 0;
    const pageRows = (json.rows ?? []).map((item) => item.row ?? {}).filter(Boolean);
    rows.push(...pageRows);

    if (pageRows.length === 0) break;
    offset += PAGE_LENGTH;
  }

  return rows;
}

export const __testables = {
  extractCandidateScores,
  isCompositeFamily,
  looksLikeTrackableFamily,
  toCandidateScore,
};

const adapter: DataSourceAdapter = {
  id: "gaia-benchmark",
  name: "GAIA Benchmark",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const supabase = ctx.supabase;
    const errors: SyncError[] = [];

    let allRows: GaiaRow[] = [];
    try {
      const splitRows = await Promise.all(
        GAIA_SPLITS.map((split) => fetchSplitRows(split, ctx.signal))
      );
      allRows = splitRows.flat();
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch GAIA public results: ${error instanceof Error ? error.message : String(error)}`,
            context: "network_error",
          },
        ],
        metadata: {
          dataset: GAIA_DATASET,
          url: GAIA_DATASET_URL,
        },
      };
    }

    const candidates = extractCandidateScores(allRows);
    if (candidates.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "GAIA results dataset returned no usable single-model rows", context: "empty_response" }],
      };
    }

    const { data: benchmark } = await supabase
      .from("benchmarks")
      .select("id")
      .eq("slug", "gaia")
      .single();

    if (!benchmark) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "gaia benchmark not found" }],
      };
    }

    const { data: models } = await supabase
      .from("models")
      .select("id, name, slug, provider")
      .eq("status", "active");

    if (!models) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "No models found" }],
      };
    }
    const modelAliasIndex = buildModelAliasIndex(models);

    let recordsProcessed = 0;
    let recordsCreated = 0;
    let skippedUnmatched = 0;
    const unmatchedFamilies: string[] = [];

    for (const candidate of candidates) {
      recordsProcessed++;
      if (!looksLikeTrackableFamily(candidate.family)) {
        skippedUnmatched++;
        unmatchedFamilies.push(candidate.family);
        continue;
      }

      const relatedIds = resolveMatchedAliasFamilyModelIds(modelAliasIndex, models, [
        candidate.family,
        candidate.submissionName,
      ]);
      if (relatedIds.length === 0) {
        skippedUnmatched++;
        unmatchedFamilies.push(candidate.family);
        continue;
      }

      for (const relatedId of relatedIds) {
        const { error } = await supabase
          .from("benchmark_scores")
          .upsert(
            buildStaticBenchmarkScoreRecord({
              modelId: relatedId,
              benchmarkId: benchmark.id,
              score: candidate.normalizedScore,
              source: "gaia-benchmark",
            }),
            { onConflict: STATIC_BENCHMARK_ON_CONFLICT }
          );

        if (error) {
          errors.push({ message: `Error upserting ${candidate.family}/${relatedId}: ${error.message}` });
          continue;
        }

        recordsCreated++;
      }

      try {
        await supabase.from("model_news").upsert(
          {
            source: "gaia-benchmark",
            source_id: `gaia-${relatedIds[0]}`,
            title: `${candidate.family} - GAIA`,
            related_model_ids: relatedIds,
            summary: `GAIA score ${candidate.normalizedScore.toFixed(1)} from ${candidate.submissionName}`,
            url: candidate.url ?? GAIA_DATASET_URL,
            published_at: candidate.date
              ? new Date(`${candidate.date}T00:00:00.000Z`).toISOString()
              : new Date().toISOString(),
            category: "benchmark",
            related_provider: null,
            tags: ["benchmark", "agent", "gaia"],
            metadata: {
              benchmark_slug: "gaia",
              model_family: candidate.family,
              submission_name: candidate.submissionName,
              organisation: candidate.organisation,
              level_breakdown: candidate.levelBreakdown,
            },
          },
          { onConflict: "source,source_id" }
        );
      } catch {
        // Traceability write is best-effort only.
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: {
        dataset: GAIA_DATASET,
        url: GAIA_DATASET_URL,
        totalRowsFetched: allRows.length,
        candidateFamilies: candidates.length,
        skippedUnmatched,
        unmatchedFamiliesSample: unmatchedFamilies.slice(0, 20),
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const rows = await fetchSplitRows("validation");
      return {
        healthy: rows.length > 0,
        latencyMs: Date.now() - start,
        message: rows.length > 0 ? "GAIA public results reachable" : "GAIA public results returned no rows",
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
