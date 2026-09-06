import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry } from "../utils";
import { z } from "zod";
import {
  normalizeRemoteBenchmarkDate,
  stripHtml,
  syncRemoteBenchmarkEntries,
  type RemoteBenchmarkEntry,
} from "./remote-benchmark";

const TERMINAL_BENCH_URL = "https://www.tbench.ai/leaderboard/terminal-bench/2.0";
// The official site moved its leaderboard to Harbor in August 2026.
const TERMINAL_BENCH_API = "https://ofhuhcpkvzjlejydnvyd.supabase.co/functions/v1/leaderboard-read";
const TERMINAL_BENCH_PACKAGE = "terminal-bench/terminal-bench-2";

const LeaderboardSchema = z.object({
  leaderboard: z.object({ package: z.literal(TERMINAL_BENCH_PACKAGE), name: z.literal("2-0") }),
  rows: z.array(z.unknown()),
});
const RowSchema = z.object({
  metadata: z.object({
    model_display: z.string().trim().min(1),
    model_names: z.array(z.string()).optional(),
    date: z.string().optional(),
  }),
  metrics: z.object({ accuracy: z.number().finite().min(0).max(100) }),
  status: z.literal("display"),
});

export function parseTerminalBenchLeaderboardJson(value: unknown): RemoteBenchmarkEntry[] {
  const parsed = LeaderboardSchema.safeParse(value);
  if (!parsed.success) return [];
  const bestByModel = new Map<string, RemoteBenchmarkEntry>();
  for (const candidate of parsed.data.rows) {
    const row = RowSchema.safeParse(candidate);
    if (!row.success) continue;
    const { metadata, metrics } = row.data;
    // Ensemble results cannot be attributed to each participating model.
    if ((metadata.model_names?.length ?? 0) > 1 || /^multiple$/i.test(metadata.model_display)) continue;
    const name = metadata.model_display;
    const score = Number(metrics.accuracy.toFixed(2));
    const evaluationDate = normalizeRemoteBenchmarkDate(metadata.date);
    const current = bestByModel.get(name);
    if (!current || score > current.score || (score === current.score && (evaluationDate ?? "") > (current.evaluationDate ?? ""))) {
      bestByModel.set(name, { matchNames: [name, ...(metadata.model_names ?? [])], score, evaluationDate });
    }
  }
  return [...bestByModel.values()].sort((left, right) => right.score - left.score);
}

async function fetchTerminalBenchEntries(signal?: AbortSignal) {
  const response = await fetchWithRetry(TERMINAL_BENCH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "AI-Market-Cap-Bot" },
    body: JSON.stringify({ package: TERMINAL_BENCH_PACKAGE, name: "2-0" }),
    signal,
  }, { signal });
  if (!response.ok) throw new Error(`TerminalBench returned HTTP ${response.status}`);
  const entries = parseTerminalBenchLeaderboardJson(await response.json());
  if (entries.length === 0) throw new Error("TerminalBench 2.0 returned no usable model rows");
  return entries;
}

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
    const score = Number(cells[7].match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN);

    if (!modelName || !Number.isFinite(score) || score < 0 || score > 100) continue;

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
    let entries: RemoteBenchmarkEntry[];
    try {
      entries = await fetchTerminalBenchEntries(ctx.signal);
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

    return syncRemoteBenchmarkEntries(ctx, {
      benchmarkSlug: "terminal-bench",
      source: "terminal-bench",
      entries,
      metadata: {
        url: TERMINAL_BENCH_URL,
        apiUrl: TERMINAL_BENCH_API,
        parsedEntries: entries.length,
      },
    });
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const entries = await fetchTerminalBenchEntries(AbortSignal.timeout(5000));
      return { healthy: true, latencyMs: Date.now() - start, message: `${entries.length} Terminal-Bench 2.0 models` };
    } catch (error) {
      return { healthy: false, latencyMs: Date.now() - start, message: error instanceof Error ? error.message : "TerminalBench unavailable" };
    }
  },
};

registerAdapter(adapter);
export default adapter;
