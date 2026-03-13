import { JSDOM } from "jsdom";
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

interface VisionArenaRow {
  modelName: string;
  aliases: string[];
  eloScore: number;
  confidenceIntervalLow: number | null;
  confidenceIntervalHigh: number | null;
  votes: number | null;
  rank: number | null;
  metadata: {
    sourceUrl: string | null;
  };
}

const SOURCE_URL = "https://arena.ai/leaderboard/vision/overall";
const ARENA_NAME = "vision-arena";

function toAliases(modelName: string): string[] {
  const aliases = new Set<string>();
  const trimmed = modelName.trim();
  if (!trimmed) return [];

  aliases.add(trimmed);
  aliases.add(trimmed.replace(/-/g, " "));
  aliases.add(trimmed.replace(/\./g, " "));
  aliases.add(trimmed.replace(/[-.]/g, " ").replace(/\s+/g, " ").trim());

  return Array.from(aliases)
    .map((alias) => alias.trim())
    .filter(Boolean);
}

function parseInteger(text: string): number | null {
  const normalized = text.replace(/,/g, "").trim();
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function extractVisionArenaRows(html: string): VisionArenaRow[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const rows = Array.from(document.querySelectorAll("table tbody tr"));

  return rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 5) return null;

      const rank = parseInteger(cells[0]?.textContent ?? "");
      const modelLink = cells[2]?.querySelector("a");
      const modelName = modelLink?.textContent?.trim() ?? "";
      const scoreText = cells[3]?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const scoreMatch = scoreText.match(/(\d+)\s*±\s*(\d+)/);
      const eloScore = scoreMatch ? Number(scoreMatch[1]) : null;
      const spread = scoreMatch ? Number(scoreMatch[2]) : null;
      const votes = parseInteger(cells[4]?.textContent ?? "");

      if (!modelName || eloScore == null) return null;

      return {
        modelName,
        aliases: toAliases(modelName),
        eloScore,
        confidenceIntervalLow: spread == null ? null : eloScore - spread,
        confidenceIntervalHigh: spread == null ? null : eloScore + spread,
        votes,
        rank,
        metadata: {
          sourceUrl: modelLink?.getAttribute("href") ?? null,
        },
      };
    })
    .filter((row): row is VisionArenaRow => row !== null);
}

const adapter: DataSourceAdapter = {
  id: "vision-arena",
  name: "Vision Arena",
  outputTypes: ["elo_ratings"],
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
          Accept: "text/html,application/xhtml+xml",
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
        errors: [{ message: `Failed to fetch Vision Arena: ${response.message}`, context: "network_error" }],
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
        errors: [{ message: `Vision Arena returned HTTP ${response.status}: ${body.slice(0, 200)}`, context: "api_error" }],
        metadata: { sourceUrl: url },
      };
    }

    const html = await response.text();
    const scores = extractVisionArenaRows(html);
    if (scores.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "Vision Arena page contained no usable leaderboard rows", context: "empty_response" }],
        metadata: { sourceUrl: url },
      };
    }

    const { data: models } = await ctx.supabase
      .from("models")
      .select("id, name, slug, provider")
      .eq("status", "active");
    const activeModels = models ?? [];
    const today = new Date().toISOString().split("T")[0];

    let recordsProcessed = 0;
    let recordsCreated = 0;

    for (const score of scores) {
      recordsProcessed++;
      const match =
        score.aliases
          .map((alias) => fuzzyMatchModel(alias, activeModels))
          .find(Boolean) ?? null;

      if (!match) continue;

      const { error } = await ctx.supabase.from("elo_ratings").upsert(
        {
          model_id: match.id,
          arena_name: ARENA_NAME,
          elo_score: score.eloScore,
          confidence_interval_low: score.confidenceIntervalLow,
          confidence_interval_high: score.confidenceIntervalHigh,
          num_battles: score.votes,
          rank: score.rank,
          snapshot_date: today,
        },
        { onConflict: "model_id,arena_name,snapshot_date" }
      );

      if (error) {
        errors.push({
          message: `elo_ratings upsert for ${score.modelName}: ${error.message}`,
        });
        continue;
      }

      recordsCreated++;
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
        message: response.ok ? "Vision Arena page reachable" : `Vision Arena returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `Vision Arena unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

export const __testables = {
  extractVisionArenaRows,
};

registerAdapter(adapter);
export default adapter;
