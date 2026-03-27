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

interface AiderLeaderboardEntry {
  modelName: string;
  score: number;
  conformRate: number | null;
  editFormat: string | null;
  command: string | null;
  date: string | null;
  aliases: string[];
}

interface PersistedEntry extends AiderLeaderboardEntry {
  sourceUrl: string;
}

const SOURCE_URL = "https://aider.chat/docs/leaderboards/";
const BENCHMARK_SLUG = "aider-polyglot";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parsePercent(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractDetailMap(detailsHtml: string): Record<string, string> {
  const details: Record<string, string> = {};

  for (const match of detailsHtml.matchAll(/<li[\s\S]*?<strong>[\s\S]*?<\/strong>\s*:?\s*([\s\S]*?)<\/li>/gi)) {
    const full = match[0];
    const keyMatch = full.match(/<strong>[\s\S]*?([A-Za-z0-9 %_-]+)[\s\S]*?<\/strong>/i);
    const key = keyMatch ? stripHtml(keyMatch[1]) : null;
    const value = stripHtml(match[1]);
    if (key && value) details[key] = value;
  }

  return details;
}

function extractCommandAliases(command: string | null): string[] {
  if (!command) return [];

  const aliases = new Set<string>([command]);
  const match = command.match(/--model\s+([^\s`]+)/);
  if (!match) return Array.from(aliases);

  const rawModelRef = match[1].trim();
  aliases.add(rawModelRef);

  const parts = rawModelRef.split("/").filter(Boolean);
  const lastPart = parts.at(-1);
  if (lastPart) aliases.add(lastPart);

  if (parts.length >= 2) aliases.add(parts.slice(-2).join("/"));

  return Array.from(aliases);
}

export function extractAiderLeaderboardEntries(html: string): PersistedEntry[] {
  const tbodyMatch = html.match(
    /Aider polyglot coding leaderboard[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i
  );
  if (!tbodyMatch) return [];

  const entries: PersistedEntry[] = [];
  const rowPattern =
    /<tr id="main-row-(\d+)">([\s\S]*?)<\/tr>\s*<tr class="details-row" id="details-\1"[\s\S]*?<td colspan="7"[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  for (const match of tbodyMatch[1].matchAll(rowPattern)) {
    const mainRowHtml = match[2];
    const detailsHtml = match[3];
    const cells = Array.from(mainRowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), (cell) => cell[1]);
    if (cells.length < 7) continue;

    const modelName = stripHtml(cells[1]);
    const score = parsePercent(stripHtml(cells[2]));
    if (!modelName || score == null) continue;

    const command = stripHtml(cells[4]) || null;
    const conformRate = parsePercent(stripHtml(cells[5]));
    const editFormat = stripHtml(cells[6]) || null;
    const details = extractDetailMap(detailsHtml);
    const aliases = new Set<string>([modelName, ...(details.Model ? [details.Model] : []), ...extractCommandAliases(command)]);

    entries.push({
      modelName,
      score,
      conformRate,
      editFormat,
      command,
      date: details.Date ?? null,
      aliases: Array.from(aliases),
      sourceUrl: SOURCE_URL,
    });
  }

  return entries.sort((left, right) => right.score - left.score);
}

const adapter: DataSourceAdapter = {
  id: "aider-polyglot",
  name: "Aider Polyglot",
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
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "AI-Market-Cap-Bot",
        },
        signal: ctx.signal,
      },
      { signal: ctx.signal, maxRetries: 4, baseDelayMs: 1500 }
    ).catch((error) => error);

    if (response instanceof Error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: `Failed to fetch Aider leaderboard: ${response.message}`, context: "network_error" }],
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
        errors: [{ message: `Aider leaderboard returned HTTP ${response.status}: ${body.slice(0, 200)}`, context: "api_error" }],
        metadata: { sourceUrl: url },
      };
    }

    const html = await response.text();
    const entries = extractAiderLeaderboardEntries(html);
    if (entries.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "Aider leaderboard contained no usable model scores", context: "empty_response" }],
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

    const bestEntryByModel = new Map<string, PersistedEntry>();
    let recordsProcessed = 0;

    for (const entry of entries) {
      recordsProcessed++;
      const relatedIds = resolveMatchedAliasFamilyModelIds(
        modelAliasIndex,
        activeModels,
        entry.aliases
      );

      if (relatedIds.length === 0) {
        errors.push({ message: `No match for: ${entry.modelName}` });
        continue;
      }

      for (const modelId of relatedIds) {
        const existing = bestEntryByModel.get(modelId);
        if (!existing || entry.score > existing.score) {
          bestEntryByModel.set(modelId, entry);
        }
      }
    }

    let recordsCreated = 0;
    for (const [modelId, entry] of bestEntryByModel.entries()) {
      const { error } = await ctx.supabase.from("benchmark_scores").upsert(
        {
          model_id: modelId,
          benchmark_id: benchmark.id,
          score: entry.score,
          score_normalized: entry.score,
          model_version: "",
          source: "aider",
          source_url: entry.sourceUrl,
          evaluation_date: entry.date ?? new Date().toISOString().split("T")[0],
          metadata: {
            aliases: entry.aliases,
            command: entry.command,
            correct_edit_format_percent: entry.conformRate,
            edit_format: entry.editFormat,
            leaderboard_model_name: entry.modelName,
          },
        },
        { onConflict: "model_id,benchmark_id,model_version" }
      );

      if (error) {
        errors.push({ message: `Failed to upsert Aider score for ${entry.modelName}: ${error.message}` });
        continue;
      }

      recordsCreated++;
    }

    return {
      success: recordsCreated > 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: recordsCreated,
      errors,
      metadata: { sourceUrl: url, leaderboardEntries: entries.length, matchedModels: bestEntryByModel.size },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    try {
      const response = await fetchWithRetry(
        SOURCE_URL,
        {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "AI-Market-Cap-Bot",
          },
        },
        { maxRetries: 2, baseDelayMs: 1000 }
      );

      return {
        healthy: response.ok,
        latencyMs: Date.now() - startedAt,
        message: response.ok ? "ok" : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

registerAdapter(adapter);

export const __testables = {
  extractAiderLeaderboardEntries,
  extractCommandAliases,
};
