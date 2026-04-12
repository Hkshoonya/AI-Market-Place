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
  syncRemoteBenchmarkEntries,
  type RemoteBenchmarkEntry,
} from "./remote-benchmark";

const TAU_BENCH_BASE_URL =
  "https://sierra-tau-bench-public.s3.us-west-2.amazonaws.com/submissions";

interface TauBenchManifest {
  submissions?: string[];
}

interface TauBenchSubmission {
  model_name?: string;
  submission_date?: string;
  submission_type?: string;
  methodology?: {
    verification?: {
      modified_prompts?: boolean;
      omitted_questions?: boolean;
    };
  };
  results?: Record<
    string,
    {
      pass_1?: number | null;
    }
  >;
}

function computeTauBenchOverallPass1(submission: TauBenchSubmission) {
  const pass1Values = Object.values(submission.results ?? {})
    .map((result) => result?.pass_1)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (pass1Values.length === 0) return null;
  return Number(
    (pass1Values.reduce((sum, value) => sum + value, 0) / pass1Values.length).toFixed(2)
  );
}

function isVerifiedTauBenchSubmission(submission: TauBenchSubmission) {
  return (
    submission.submission_type === "standard" &&
    submission.methodology?.verification?.modified_prompts === false &&
    submission.methodology?.verification?.omitted_questions === false
  );
}

export function extractTauBenchEntries(
  submissions: TauBenchSubmission[]
): RemoteBenchmarkEntry[] {
  const bestByModel = new Map<string, RemoteBenchmarkEntry>();

  for (const submission of submissions) {
    if (!isVerifiedTauBenchSubmission(submission)) continue;

    const modelName = submission.model_name?.trim() ?? "";
    const score = computeTauBenchOverallPass1(submission);
    const evaluationDate = normalizeRemoteBenchmarkDate(submission.submission_date);

    if (!modelName || score == null) continue;

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

async function fetchTauBenchManifest(signal?: AbortSignal) {
  const res = await fetchWithRetry(
    `${TAU_BENCH_BASE_URL}/manifest.json`,
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
    throw new Error(`manifest returned HTTP ${res.status}`);
  }

  return (await res.json()) as TauBenchManifest;
}

async function fetchTauBenchSubmission(
  submissionDir: string,
  signal?: AbortSignal
) {
  const res = await fetchWithRetry(
    `${TAU_BENCH_BASE_URL}/${submissionDir}/submission.json`,
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
    throw new Error(`${submissionDir} returned HTTP ${res.status}`);
  }

  return (await res.json()) as TauBenchSubmission;
}

const adapter: DataSourceAdapter = {
  id: "tau-bench",
  name: "TAU-Bench",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    let manifest: TauBenchManifest;
    try {
      manifest = await fetchTauBenchManifest(ctx.signal);
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch TAU-Bench manifest: ${error instanceof Error ? error.message : String(error)}`,
            context: "network_error",
          },
        ],
        metadata: { url: `${TAU_BENCH_BASE_URL}/manifest.json` },
      };
    }

    const submissionDirs = manifest.submissions ?? [];
    const submissions: TauBenchSubmission[] = [];
    const errors: { message: string; context?: string }[] = [];

    for (const submissionDir of submissionDirs) {
      try {
        submissions.push(await fetchTauBenchSubmission(submissionDir, ctx.signal));
      } catch (error) {
        errors.push({
          message: `Failed to fetch TAU-Bench submission ${submissionDir}: ${error instanceof Error ? error.message : String(error)}`,
          context: "submission_error",
        });
      }
    }

    const entries = extractTauBenchEntries(submissions);
    if (entries.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          ...errors,
          { message: "TAU-Bench returned no usable verified standard rows", context: "empty_response" },
        ],
        metadata: {
          url: `${TAU_BENCH_BASE_URL}/manifest.json`,
          submissions: submissionDirs.length,
        },
      };
    }

    const syncResult = await syncRemoteBenchmarkEntries(ctx, {
      benchmarkSlug: "tau-bench",
      source: "tau-bench",
      entries,
      metadata: {
        url: `${TAU_BENCH_BASE_URL}/manifest.json`,
        submissions: submissionDirs.length,
        parsedEntries: entries.length,
      },
    });

    return {
      ...syncResult,
      success: syncResult.success && errors.length === 0,
      errors: [...errors, ...syncResult.errors],
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    return runRemoteBenchmarkHealthCheck(
      `${TAU_BENCH_BASE_URL}/manifest.json`,
      (body) => {
        try {
          const manifest = JSON.parse(body) as TauBenchManifest;
          return manifest.submissions?.length ?? 0;
        } catch {
          return 0;
        }
      }
    );
  },
};

registerAdapter(adapter);
export default adapter;
