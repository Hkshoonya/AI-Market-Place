import type {
  HealthCheckResult,
  SyncContext,
  SyncError,
  SyncResult,
} from "../types";
import { fetchWithRetry } from "../utils";
import {
  buildModelAliasIndex,
  fetchAllActiveAliasModels,
  resolveMatchedAliasFamilyModelIds,
} from "../model-alias-resolver";
import {
  STATIC_BENCHMARK_ON_CONFLICT,
  buildStaticBenchmarkScoreRecord,
} from "./static-benchmark";

export interface RemoteBenchmarkEntry {
  matchNames: string[];
  score: number;
  evaluationDate?: string | null;
}

export function normalizeRemoteBenchmarkDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }

  const monthYear = normalized.match(/^(\d{2})\/(\d{4})$/);
  if (monthYear) {
    return `${monthYear[2]}-${monthYear[1]}-01`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(value: string) {
  return decodeHtmlEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (char !== "\r") {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export async function syncRemoteBenchmarkEntries(
  ctx: SyncContext,
  input: {
    benchmarkSlug: string;
    source: string;
    entries: RemoteBenchmarkEntry[];
    metadata?: Record<string, unknown>;
  }
): Promise<SyncResult> {
  const supabase = ctx.supabase;
  const errors: SyncError[] = [];

  const { data: benchmark } = await supabase
    .from("benchmarks")
    .select("id")
    .eq("slug", input.benchmarkSlug)
    .single();

  if (!benchmark) {
    return {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [{ message: `${input.benchmarkSlug} benchmark not found` }],
      metadata: input.metadata,
    };
  }

  const models = await fetchAllActiveAliasModels(supabase);
  if (models.length === 0) {
    return {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [{ message: "No models found" }],
      metadata: input.metadata,
    };
  }

  const modelAliasIndex = buildModelAliasIndex(models);
  let recordsProcessed = 0;
  let recordsCreated = 0;
  let skippedUnmatched = 0;
  const unmatchedNames: string[] = [];

  for (const entry of input.entries) {
    recordsProcessed += 1;
    const relatedIds = resolveMatchedAliasFamilyModelIds(
      modelAliasIndex,
      models,
      entry.matchNames
    );

    if (relatedIds.length === 0) {
      skippedUnmatched += 1;
      unmatchedNames.push(entry.matchNames[0] ?? "unknown");
      continue;
    }

    for (const relatedId of relatedIds) {
      const { error } = await supabase
        .from("benchmark_scores")
        .upsert(
          buildStaticBenchmarkScoreRecord({
            modelId: relatedId,
            benchmarkId: benchmark.id,
            score: entry.score,
            source: input.source,
            evaluationDate: entry.evaluationDate ?? null,
          }),
          { onConflict: STATIC_BENCHMARK_ON_CONFLICT }
        );

      if (error) {
        errors.push({
          message: `Error upserting ${entry.matchNames[0] ?? relatedId}/${relatedId}: ${error.message}`,
        });
        continue;
      }

      recordsCreated += 1;
    }
  }

  return {
    success: errors.length === 0,
    recordsProcessed,
    recordsCreated,
    recordsUpdated: 0,
    errors,
    metadata: {
      ...(input.metadata ?? {}),
      skippedUnmatched,
      unmatchedNamesSample: unmatchedNames.slice(0, 20),
    },
  };
}

export async function runRemoteBenchmarkHealthCheck(
  url: string,
  parseResult: (body: string) => number | null | undefined
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetchWithRetry(
      url,
      {
        headers: {
          Accept: "*/*",
          "User-Agent": "AI-Market-Cap-Bot",
        },
      },
      { maxRetries: 2, baseDelayMs: 500 }
    );
    if (!res.ok) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `HTTP ${res.status}`,
      };
    }

    const body = await res.text();
    const parsedCount = parseResult(body);
    return {
      healthy: Boolean(parsedCount && parsedCount > 0),
      latencyMs: Date.now() - start,
      message: parsedCount && parsedCount > 0 ? `${parsedCount} entries visible` : "No usable entries found",
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
