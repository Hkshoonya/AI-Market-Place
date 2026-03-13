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

interface LiveCodeBenchPerformance {
  model?: unknown;
  difficulty?: unknown;
  "pass@1"?: unknown;
}

interface LiveCodeBenchModelMeta {
  model_name?: unknown;
  model_repr?: unknown;
  release_date?: unknown;
  link?: unknown;
}

interface LiveCodeBenchPayload {
  performances?: LiveCodeBenchPerformance[];
  models?: LiveCodeBenchModelMeta[];
}

interface ExtractedModelScore {
  modelName: string;
  aliases: string[];
  score: number;
  normalizedScore: number;
  sampleCount: number;
  metadata: {
    sourceUrl: string | null;
    releaseDate: string | null;
    difficultyBreakdown: Record<string, number>;
  };
}

const SOURCE_URL =
  "https://raw.githubusercontent.com/LiveCodeBench/livecodebench.github.io/main/build/performances_generation.json";
const SOURCE_SITE = "https://livecodebench.github.io/leaderboard.html";
const BENCHMARK_SLUG = "livecodebench";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toIsoDate(timestamp: unknown): string | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().split("T")[0];
}

export function extractModelScores(payload: LiveCodeBenchPayload): ExtractedModelScore[] {
  const modelMetaByName = new Map<string, LiveCodeBenchModelMeta>();
  for (const model of payload.models ?? []) {
    const repr = typeof model.model_repr === "string" ? model.model_repr.trim() : "";
    const name = typeof model.model_name === "string" ? model.model_name.trim() : "";
    if (repr) modelMetaByName.set(repr, model);
    if (name) modelMetaByName.set(name, model);
  }

  const grouped = new Map<
    string,
    {
      modelName: string;
      aliases: Set<string>;
      scores: number[];
      difficultyMap: Map<string, number[]>;
      sourceUrl: string | null;
      releaseDate: string | null;
    }
  >();

  for (const row of payload.performances ?? []) {
    const modelName = typeof row.model === "string" ? row.model.trim() : "";
    const passAtOne =
      typeof row["pass@1"] === "number" && Number.isFinite(row["pass@1"])
        ? row["pass@1"]
        : null;
    if (!modelName || passAtOne == null) continue;

    const meta = modelMetaByName.get(modelName);
    const canonicalName =
      typeof meta?.model_repr === "string" && meta.model_repr.trim()
        ? meta.model_repr.trim()
        : modelName;
    const key = canonicalName.toLowerCase();
    const difficulty =
      typeof row.difficulty === "string" && row.difficulty.trim()
        ? row.difficulty.trim().toLowerCase()
        : "unknown";

    const existing = grouped.get(key) ?? {
      modelName: canonicalName,
      aliases: new Set<string>(),
      scores: [],
      difficultyMap: new Map<string, number[]>(),
      sourceUrl: typeof meta?.link === "string" ? meta.link : null,
      releaseDate: toIsoDate(meta?.release_date),
    };

    existing.aliases.add(canonicalName);
    existing.aliases.add(modelName);
    if (typeof meta?.model_name === "string" && meta.model_name.trim()) {
      existing.aliases.add(meta.model_name.trim());
    }
    existing.scores.push(passAtOne);
    existing.difficultyMap.set(difficulty, [
      ...(existing.difficultyMap.get(difficulty) ?? []),
      passAtOne,
    ]);

    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      modelName: entry.modelName,
      aliases: Array.from(entry.aliases),
      score: average(entry.scores),
      normalizedScore: average(entry.scores),
      sampleCount: entry.scores.length,
      metadata: {
        sourceUrl: entry.sourceUrl,
        releaseDate: entry.releaseDate,
        difficultyBreakdown: Object.fromEntries(
          Array.from(entry.difficultyMap.entries()).map(([difficulty, scores]) => [
            difficulty,
            average(scores),
          ])
        ),
      },
    }))
    .sort((left, right) => right.score - left.score);
}

const adapter: DataSourceAdapter = {
  id: "livecodebench",
  name: "LiveCodeBench",
  outputTypes: ["benchmarks"],
  defaultConfig: {
    url: SOURCE_URL,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const url = typeof ctx.config.url === "string" ? ctx.config.url : SOURCE_URL;
    const errors: SyncError[] = [];
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "AI-Market-Cap-Bot",
        },
        signal: ctx.signal,
      },
      { signal: ctx.signal }
    ).catch((error) => error);

    if (response instanceof Error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `Failed to fetch LiveCodeBench: ${response.message}`, context: "network_error" }],
        metadata: { sourceUrl: url },
      };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `LiveCodeBench returned HTTP ${response.status}: ${body.slice(0, 200)}`, context: "api_error" }],
        metadata: { sourceUrl: url },
      };
    }

    const payload = (await response.json()) as LiveCodeBenchPayload;
    const scores = extractModelScores(payload);
    if (scores.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "LiveCodeBench payload contained no usable model scores", context: "empty_response" }],
        metadata: { sourceUrl: url },
      };
    }

    const { data: benchmark } = await ctx.supabase
      .from("benchmarks")
      .select("id")
      .eq("slug", BENCHMARK_SLUG)
      .single();
    if (!benchmark) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `Benchmark ${BENCHMARK_SLUG} not found` }],
      };
    }

    const { data: models } = await ctx.supabase
      .from("models")
      .select("id, name, slug, provider")
      .eq("status", "active");
    const activeModels = models ?? [];
    const modelAliasIndex = buildModelAliasIndex(activeModels);

    let recordsCreated = 0;
    let recordsProcessed = 0;

    for (const score of scores) {
      recordsProcessed++;
      const relatedIds = resolveMatchedAliasFamilyModelIds(
        modelAliasIndex,
        activeModels,
        score.aliases
      );

      if (relatedIds.length === 0) continue;

      for (const relatedId of relatedIds) {
        const { error } = await ctx.supabase.from("benchmark_scores").upsert(
          {
            model_id: relatedId,
            benchmark_id: benchmark.id,
            score: score.score,
            score_normalized: score.normalizedScore,
            model_version: "",
            source: "livecodebench",
            source_url: score.metadata.sourceUrl ?? SOURCE_SITE,
            evaluation_date: new Date().toISOString().split("T")[0],
            metadata: {
              sample_count: score.sampleCount,
              difficulty_breakdown: score.metadata.difficultyBreakdown,
              release_date: score.metadata.releaseDate,
              aliases: score.aliases,
            },
          },
          { onConflict: "model_id,benchmark_id,model_version" }
        );

        if (error) {
          errors.push({
            message: `benchmark_scores upsert for ${score.modelName}/${relatedId}: ${error.message}`,
          });
          continue;
        }

        recordsCreated++;
      }

      try {
        await ctx.supabase.from("model_news").upsert(
          {
            source: "livecodebench",
            source_id: `livecodebench-${relatedIds[0]}`,
            title: `${score.modelName} - LiveCodeBench`,
            related_model_ids: relatedIds,
            summary: `LiveCodeBench pass@1 ${score.normalizedScore.toFixed(1)} across ${score.sampleCount} tasks`,
            url: score.metadata.sourceUrl ?? SOURCE_SITE,
            published_at: new Date().toISOString(),
            category: "benchmark",
            related_provider: null,
            tags: ["benchmark", "coding", "livecodebench"],
            metadata: {
              benchmark_slug: BENCHMARK_SLUG,
              normalized_score: score.normalizedScore,
              sample_count: score.sampleCount,
              difficulty_breakdown: score.metadata.difficultyBreakdown,
            },
          },
          { onConflict: "source,source_id" }
        );
      } catch {
        // Traceability is best-effort only; benchmark_scores is the durable record.
      }
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      errors,
      metadata: {
        sourceUrl: url,
        modelsFound: scores.length,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetchWithRetry(SOURCE_URL, undefined, { maxRetries: 1 });
      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        message: response.ok ? "LiveCodeBench artifact reachable" : `LiveCodeBench returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `LiveCodeBench unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const __testables = {
  extractModelScores,
};

registerAdapter(adapter);
export default adapter;
