import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry } from "../utils";
import {
  normalizeRemoteBenchmarkDate,
  parseCsvRows,
  runRemoteBenchmarkHealthCheck,
  syncRemoteBenchmarkEntries,
  type RemoteBenchmarkEntry,
} from "./remote-benchmark";

const WEBARENA_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1M801lEpBbKSNwP-vDBkC_pF7LdyGU1f_ufZb_NWNBZQ/export?format=csv";

function isTrackableWebArenaModelLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("+")) return false;

  return /(gpt|claude|gemini|llama|qwen|deepseek|grok|mistral|kimi|\bo1\b|\bo3\b|\bo4\b)/.test(
    normalized
  );
}

export function parseWebArenaCsv(text: string): RemoteBenchmarkEntry[] {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length === 0) return [];

  const header = rows[0].map((cell) => cell.trim());
  const dateIndex = header.indexOf("a");
  const modelIndex = header.indexOf("Model");
  const scoreIndex = header.indexOf("Success Rate (%)");

  if (modelIndex === -1 || scoreIndex === -1) {
    return [];
  }

  const bestByModel = new Map<string, RemoteBenchmarkEntry>();

  for (const row of rows.slice(1)) {
    const modelName = row[modelIndex]?.trim() ?? "";
    const score = Number(row[scoreIndex] ?? "");
    const evaluationDate =
      dateIndex >= 0 ? normalizeRemoteBenchmarkDate(row[dateIndex]) : null;

    if (!isTrackableWebArenaModelLabel(modelName) || !Number.isFinite(score)) {
      continue;
    }

    const current = bestByModel.get(modelName);
    if (
      !current ||
      score > current.score ||
      (score === current.score &&
        (evaluationDate ?? "") > (current.evaluationDate ?? ""))
    ) {
      bestByModel.set(modelName, {
        matchNames: [modelName],
        score,
        evaluationDate,
      });
    }
  }

  return [...bestByModel.values()].sort((left, right) => right.score - left.score);
}

const adapter: DataSourceAdapter = {
  id: "webarena",
  name: "WebArena",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    let csv: string;
    try {
      const res = await fetchWithRetry(
        WEBARENA_CSV_URL,
        {
          headers: {
            Accept: "text/csv",
            "User-Agent": "AI-Market-Cap-Bot",
          },
          signal: ctx.signal,
        },
        { signal: ctx.signal }
      );
      if (!res.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{ message: `WebArena returned HTTP ${res.status}`, context: "api_error" }],
          metadata: { url: WEBARENA_CSV_URL },
        };
      }
      csv = await res.text();
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch WebArena leaderboard: ${error instanceof Error ? error.message : String(error)}`,
            context: "network_error",
          },
        ],
        metadata: { url: WEBARENA_CSV_URL },
      };
    }

    const entries = parseWebArenaCsv(csv);
    if (entries.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "WebArena returned no usable model rows", context: "empty_response" }],
        metadata: { url: WEBARENA_CSV_URL },
      };
    }

    return syncRemoteBenchmarkEntries(ctx, {
      benchmarkSlug: "webarena",
      source: "webarena",
      entries,
      metadata: {
        url: WEBARENA_CSV_URL,
        parsedEntries: entries.length,
      },
    });
  },

  async healthCheck(): Promise<HealthCheckResult> {
    return runRemoteBenchmarkHealthCheck(WEBARENA_CSV_URL, (body) =>
      parseWebArenaCsv(body).length
    );
  },
};

registerAdapter(adapter);
export default adapter;
