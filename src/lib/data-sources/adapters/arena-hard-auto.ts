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
  fetchAllActiveAliasModels,
  resolveMatchedAliasFamilyModelIds,
} from "../model-alias-resolver";

interface ExtractedArenaHardScore {
  modelName: string;
  aliases: string[];
  score: number;
  normalizedScore: number;
  metadata: {
    leaderboard: string;
    judge: string;
    sourceUrl: string;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  };
}

const SOURCE_URL = "https://raw.githubusercontent.com/lmarena/arena-hard-auto/main/README.md";
const SOURCE_SITE = "https://github.com/lmarena/arena-hard-auto#leaderboard";
const BENCHMARK_SLUG = "arena-hard-auto";
const LEADERBOARD_NAME = "Arena-Hard-v2.0-Preview";
const OFFICIAL_MARKER = "Hard Prompt, Style Control, and Gemini-2.5 as Judge **(Official Configuration)**:";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toAliasSet(modelName: string): string[] {
  const aliases = new Set<string>();
  const trimmed = modelName.trim();
  if (!trimmed) return [];

  aliases.add(trimmed);
  aliases.add(trimmed.replace(/-/g, " "));
  aliases.add(trimmed.replace(/\./g, " "));
  aliases.add(trimmed.replace(/[-.]/g, " ").replace(/\s+/g, " ").trim());

  if (/^o\d+-/.test(trimmed)) {
    aliases.add(trimmed.split("-")[0]);
  }

  const claudeMatch = trimmed.match(/^claude-(\d)-(\d)-([a-z]+)(?:-\d+)?/i);
  if (claudeMatch) {
    aliases.add(`claude ${claudeMatch[1]}.${claudeMatch[2]} ${claudeMatch[3]}`.toLowerCase());
  }

  return Array.from(aliases)
    .map((alias) => alias.trim())
    .filter(Boolean);
}

function parseScoreRow(line: string): ExtractedArenaHardScore | null {
  const match = line.match(
    /^\s*\d+\s+(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+\((-?[0-9]+(?:\.[0-9]+)?)\s*\/\s*\+?([0-9]+(?:\.[0-9]+)?)\)\s*$/
  );
  if (!match) return null;

  const [, rawModelName, rawScore, rawLower, rawUpper] = match;
  const modelName = rawModelName.trim();
  const score = Number(rawScore);
  const lower = Number(rawLower);
  const upper = Number(rawUpper);

  if (!modelName || !Number.isFinite(score) || !Number.isFinite(lower) || !Number.isFinite(upper)) {
    return null;
  }

  return {
    modelName,
    aliases: toAliasSet(modelName),
    score,
    normalizedScore: score,
    metadata: {
      leaderboard: LEADERBOARD_NAME,
      judge: "gemini-2.5",
      sourceUrl: SOURCE_SITE,
      confidenceInterval: {
        lower,
        upper,
      },
    },
  };
}

export function extractOfficialScores(readme: string): ExtractedArenaHardScore[] {
  const leaderboardSectionMatch = readme.match(
    new RegExp(
      `###\\s+${escapeRegExp(LEADERBOARD_NAME)}[\\s\\S]*?${escapeRegExp(OFFICIAL_MARKER)}\\s*\\\`\\\`\\\`console\\n([\\s\\S]*?)\\n\\\`\\\`\\\``
    )
  );

  if (!leaderboardSectionMatch?.[1]) return [];

  return leaderboardSectionMatch[1]
    .split(/\r?\n/)
    .map((line) => parseScoreRow(line))
    .filter((score): score is ExtractedArenaHardScore => score !== null)
    .sort((left, right) => right.score - left.score);
}

const adapter: DataSourceAdapter = {
  id: "arena-hard-auto",
  name: "Arena-Hard-Auto",
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
          Accept: "text/plain, text/markdown;q=0.9, */*;q=0.8",
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
        errors: [{ message: `Failed to fetch Arena-Hard-Auto README: ${response.message}`, context: "network_error" }],
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
        errors: [{ message: `Arena-Hard-Auto returned HTTP ${response.status}: ${body.slice(0, 200)}`, context: "api_error" }],
        metadata: { sourceUrl: url },
      };
    }

    const readme = await response.text();
    const scores = extractOfficialScores(readme);
    if (scores.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "Arena-Hard-Auto README contained no usable official scores", context: "empty_response" }],
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

    const activeModels = await fetchAllActiveAliasModels(ctx.supabase);
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
            source: "arena-hard-auto",
            source_url: score.metadata.sourceUrl,
            evaluation_date: new Date().toISOString().split("T")[0],
            metadata: {
              judge: score.metadata.judge,
              leaderboard: score.metadata.leaderboard,
              aliases: score.aliases,
              confidence_interval: score.metadata.confidenceInterval,
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
            source: "arena-hard-auto",
            source_id: `arena-hard-auto-${relatedIds[0]}`,
            title: `${score.modelName} - Arena-Hard-Auto`,
            related_model_ids: relatedIds,
            summary: `Arena-Hard-Auto official Gemini-2.5 judged score ${score.normalizedScore.toFixed(1)} with CI ${score.metadata.confidenceInterval.lower}/${score.metadata.confidenceInterval.upper}`,
            url: score.metadata.sourceUrl,
            published_at: new Date().toISOString(),
            category: "benchmark",
            related_provider: null,
            tags: ["benchmark", "arena-hard-auto", "preference"],
            metadata: {
              benchmark_slug: BENCHMARK_SLUG,
              leaderboard: score.metadata.leaderboard,
              judge: score.metadata.judge,
              normalized_score: score.normalizedScore,
              confidence_interval: score.metadata.confidenceInterval,
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
        leaderboard: LEADERBOARD_NAME,
        judge: "gemini-2.5",
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
        message: response.ok ? "Arena-Hard-Auto README reachable" : `Arena-Hard-Auto returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `Arena-Hard-Auto unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const __testables = {
  extractOfficialScores,
};

registerAdapter(adapter);
export default adapter;
