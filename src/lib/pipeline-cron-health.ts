export const PIPELINE_CRON_EXPECTATIONS = {
  "sync-tier-1": 2,
  "sync-tier-2": 4,
  "sync-tier-3": 8,
  "sync-tier-4": 24,
  "compute-scores": 6,
} as const;

export type PipelineCronJobName = keyof typeof PIPELINE_CRON_EXPECTATIONS;

export type PipelineCronRunSnapshot = {
  job_name?: string | null;
  status?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  error_message?: string | null;
};

export type PipelineCronJobHealth = {
  jobName: PipelineCronJobName;
  expectedIntervalHours: number;
  lastRunAt: string | null;
  status: "completed" | "failed" | "running" | "missing";
  stale: boolean;
};

export type PipelineCronHealthSummary = {
  recentFailures24h: number;
  latestFailedJobCount: number;
  staleJobCount: number;
  lastRunAt: string | null;
  latestFailedJobs: PipelineCronJobName[];
  staleJobs: PipelineCronJobName[];
  criticalJobs: PipelineCronJobHealth[];
};

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const AUTO_STALE_CRON_ERROR_PREFIX = "Marked stale before acquiring cron lock for";

export function isAutoStaleCronFailure(
  run: Pick<PipelineCronRunSnapshot, "status" | "error_message">
) {
  return (
    run.status === "failed" &&
    typeof run.error_message === "string" &&
    run.error_message.startsWith(AUTO_STALE_CRON_ERROR_PREFIX)
  );
}

export function summarizePipelineCronHealth(
  cronRuns: PipelineCronRunSnapshot[],
  now = Date.now()
): PipelineCronHealthSummary {
  const recentFailureCutoffMs = now - 24 * 60 * 60 * 1000;
  const hasAnyRuns = cronRuns.length > 0;
  const criticalJobs = Object.entries(PIPELINE_CRON_EXPECTATIONS).map(
    ([jobName, expectedIntervalHours]) => {
      const latestRun =
        cronRuns
          .filter((run) => run.job_name === jobName)
          .sort(
            (left, right) =>
              toTimestamp(right.started_at ?? right.created_at) -
              toTimestamp(left.started_at ?? left.created_at)
          )[0] ?? null;

      const lastRunAt = latestRun?.started_at ?? latestRun?.created_at ?? null;
      const ageMs = lastRunAt
        ? Math.max(0, now - toTimestamp(lastRunAt))
        : Number.POSITIVE_INFINITY;
      const status: PipelineCronJobHealth["status"] =
        latestRun?.status === "completed" ||
        latestRun?.status === "failed" ||
        latestRun?.status === "running"
          ? latestRun.status
          : "missing";

      return {
        jobName: jobName as PipelineCronJobName,
        expectedIntervalHours,
        lastRunAt,
        status,
        stale: hasAnyRuns && ageMs > expectedIntervalHours * 2 * 60 * 60 * 1000,
      };
    }
  );

  const latestFailedJobs = criticalJobs
    .filter((job) => job.status === "failed")
    .map((job) => job.jobName);
  const staleJobs = criticalJobs.filter((job) => job.stale).map((job) => job.jobName);
  const sortedRuns = [...cronRuns].sort(
    (left, right) =>
      toTimestamp(right.started_at ?? right.created_at) -
      toTimestamp(left.started_at ?? left.created_at)
  );

  return {
    recentFailures24h: cronRuns.filter((run) => {
      if (run.status !== "failed" || isAutoStaleCronFailure(run)) return false;
      const timestamp = toTimestamp(run.started_at ?? run.created_at);
      return timestamp >= recentFailureCutoffMs;
    }).length,
    latestFailedJobCount: latestFailedJobs.length,
    staleJobCount: staleJobs.length,
    lastRunAt: sortedRuns[0]?.started_at ?? sortedRuns[0]?.created_at ?? null,
    latestFailedJobs,
    staleJobs,
    criticalJobs,
  };
}
