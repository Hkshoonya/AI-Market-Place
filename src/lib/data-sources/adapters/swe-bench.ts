import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncError,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry } from "../utils";
import { fuzzyMatchModel } from "../model-matcher";

interface SweBenchEntry {
  name?: unknown;
  resolved?: unknown;
  tags?: unknown;
  date?: unknown;
  site?: unknown;
}

interface SweBenchLeaderboard {
  name?: unknown;
  results?: SweBenchEntry[];
}

interface SweBenchPayload {
  leaderboards?: SweBenchLeaderboard[];
}

interface ExtractedModelScore {
  modelName: string;
  aliases: string[];
  score: number;
  normalizedScore: number;
  metadata: {
    leaderboard: string;
    date: string | null;
    site: string | null;
    submissionName: string;
  };
}

const SOURCE_URL =
  "https://raw.githubusercontent.com/SWE-bench/swe-bench.github.io/master/data/leaderboards.json";
const SOURCE_SITE = "https://www.swebench.com/";
const BENCHMARK_SLUG = "swe_bench";
const PREFERRED_LEADERBOARDS = ["Verified", "Lite", "Test", "bash-only", "Multilingual", "Multimodal"];

function normalizeSite(site: unknown): string | null {
  if (typeof site === "string") return site;
  if (Array.isArray(site)) {
    const first = site.find((entry) => typeof entry === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
}

function extractModelTag(tags: unknown): string | null {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const match = tag.match(/^Model:\s*(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function extractModelScores(payload: SweBenchPayload): ExtractedModelScore[] {
  const leaderboards = payload.leaderboards ?? [];
  const leaderboard =
    PREFERRED_LEADERBOARDS.map((name) =>
      leaderboards.find((candidate) => candidate.name === name)
    ).find(Boolean) ?? leaderboards[0];

  if (!leaderboard || !Array.isArray(leaderboard.results)) return [];

  const bestByModel = new Map<string, ExtractedModelScore>();
  for (const result of leaderboard.results) {
    const score =
      typeof result.resolved === "number" && Number.isFinite(result.resolved)
        ? result.resolved
        : null;
    const submissionName = typeof result.name === "string" ? result.name.trim() : "";
    const modelName = extractModelTag(result.tags) ?? submissionName;
    if (!modelName || score == null) continue;

    const current: ExtractedModelScore = {
      modelName,
      aliases: [modelName, submissionName].filter(Boolean),
      score,
      normalizedScore: score,
      metadata: {
        leaderboard: typeof leaderboard.name === "string" ? leaderboard.name : "unknown",
        date: typeof result.date === "string" ? result.date : null,
        site: normalizeSite(result.site),
        submissionName,
      },
    };

    const existing = bestByModel.get(modelName.toLowerCase());
    if (!existing || current.score > existing.score) {
      bestByModel.set(modelName.toLowerCase(), current);
    }
  }

  return Array.from(bestByModel.values()).sort((left, right) => right.score - left.score);
}

const adapter: DataSourceAdapter = {
  id: "swe-bench",
  name: "SWE-Bench",
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
        errors: [{ message: `Failed to fetch SWE-Bench: ${response.message}`, context: "network_error" }],
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
        errors: [{ message: `SWE-Bench returned HTTP ${response.status}: ${body.slice(0, 200)}`, context: "api_error" }],
        metadata: { sourceUrl: url },
      };
    }

    const payload = (await response.json()) as SweBenchPayload;
    const scores = extractModelScores(payload);
    if (scores.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "SWE-Bench payload contained no usable model scores", context: "empty_response" }],
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

    let recordsCreated = 0;
    let recordsProcessed = 0;

    for (const score of scores) {
      recordsProcessed++;
      const match =
        score.aliases
          .map((alias) => fuzzyMatchModel(alias, activeModels))
          .find(Boolean) ?? null;

      if (!match) continue;

      const { error } = await ctx.supabase.from("benchmark_scores").upsert(
        {
          model_id: match.id,
          benchmark_id: benchmark.id,
          score: score.score,
          score_normalized: score.normalizedScore,
          model_version: "",
          source: "swe-bench",
          source_url: score.metadata.site ?? SOURCE_SITE,
          evaluation_date: score.metadata.date ?? new Date().toISOString().split("T")[0],
          metadata: {
            leaderboard: score.metadata.leaderboard,
            submission_name: score.metadata.submissionName,
            aliases: score.aliases,
          },
        },
        { onConflict: "model_id,benchmark_id,model_version" }
      );

      if (error) {
        errors.push({
          message: `benchmark_scores upsert for ${score.modelName}: ${error.message}`,
        });
        continue;
      }

      recordsCreated++;

      try {
        await ctx.supabase.from("model_news").upsert(
          {
            source: "swe-bench",
            source_id: `swe-bench-${match.id}`,
            title: `${score.modelName} - SWE-Bench ${score.metadata.leaderboard}`,
            related_model_ids: [match.id],
            summary: `SWE-Bench ${score.metadata.leaderboard} resolved rate ${score.normalizedScore.toFixed(1)}`,
            url: score.metadata.site ?? SOURCE_SITE,
            published_at: new Date().toISOString(),
            category: "benchmark",
            related_provider: null,
            tags: ["benchmark", "coding", "agent", "swe-bench"],
            metadata: {
              benchmark_slug: BENCHMARK_SLUG,
              leaderboard: score.metadata.leaderboard,
              normalized_score: score.normalizedScore,
              submission_name: score.metadata.submissionName,
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
        message: response.ok ? "SWE-Bench artifact reachable" : `SWE-Bench returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `SWE-Bench unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const __testables = {
  extractModelScores,
};

registerAdapter(adapter);
export default adapter;
