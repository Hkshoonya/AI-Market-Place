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
  runRemoteBenchmarkHealthCheck,
  stripHtml,
  syncRemoteBenchmarkEntries,
  type RemoteBenchmarkEntry,
} from "./remote-benchmark";

const TERMINAL_BENCH_URL = "https://www.tbench.ai/leaderboard/terminal-bench/2.0";

function parseTerminalBenchRows(html: string) {
  return [...html.matchAll(/<tr data-slot="table-row"[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((match) => match[1])
    .filter((row) => row.includes("<td"));
}

export function parseTerminalBenchLeaderboardHtml(html: string): RemoteBenchmarkEntry[] {
  const bestByModel = new Map<string, RemoteBenchmarkEntry>();

  for (const row of parseTerminalBenchRows(html)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
      stripHtml(match[1])
    );

    if (cells.length < 8) continue;

    const modelName = cells[3];
    const evaluationDate = normalizeRemoteBenchmarkDate(cells[4]);
    const score = Number(cells[7].match(/(\d+(?:\.\d+)?)/)?.[1] ?? "");

    if (!modelName || !Number.isFinite(score)) continue;

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
  id: "terminal-bench",
  name: "TerminalBench 2.0",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    let html: string;
    try {
      const res = await fetchWithRetry(
        TERMINAL_BENCH_URL,
        {
          headers: {
            Accept: "text/html",
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
          errors: [{ message: `TerminalBench returned HTTP ${res.status}`, context: "api_error" }],
          metadata: { url: TERMINAL_BENCH_URL },
        };
      }
      html = await res.text();
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch TerminalBench leaderboard: ${error instanceof Error ? error.message : String(error)}`,
            context: "network_error",
          },
        ],
        metadata: { url: TERMINAL_BENCH_URL },
      };
    }

    const entries = parseTerminalBenchLeaderboardHtml(html);
    if (entries.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "TerminalBench returned no usable model rows", context: "empty_response" }],
        metadata: { url: TERMINAL_BENCH_URL },
      };
    }

    return syncRemoteBenchmarkEntries(ctx, {
      benchmarkSlug: "terminal-bench",
      source: "terminal-bench",
      entries,
      metadata: {
        url: TERMINAL_BENCH_URL,
        parsedEntries: entries.length,
      },
    });
  },

  async healthCheck(): Promise<HealthCheckResult> {
    return runRemoteBenchmarkHealthCheck(TERMINAL_BENCH_URL, (body) =>
      parseTerminalBenchLeaderboardHtml(body).length
    );
  },
};

registerAdapter(adapter);
export default adapter;
