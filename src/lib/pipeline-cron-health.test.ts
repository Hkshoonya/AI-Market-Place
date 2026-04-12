import { describe, expect, it } from "vitest";

import { summarizePipelineCronHealth } from "./pipeline-cron-health";

describe("summarizePipelineCronHealth", () => {
  const now = Date.parse("2026-03-12T00:00:00.000Z");

  it("marks failed and stale critical jobs from their latest run", () => {
    const summary = summarizePipelineCronHealth(
      [
        {
          job_name: "sync-tier-1",
          status: "completed",
          started_at: "2026-03-11T23:00:00.000Z",
          created_at: "2026-03-11T23:00:00.000Z",
        },
        {
          job_name: "compute-scores",
          status: "failed",
          started_at: "2026-03-11T20:00:00.000Z",
          created_at: "2026-03-11T20:00:00.000Z",
        },
        {
          job_name: "sync-tier-3",
          status: "completed",
          started_at: "2026-03-10T00:00:00.000Z",
          created_at: "2026-03-10T00:00:00.000Z",
        },
      ],
      now
    );

    expect(summary.latestFailedJobs).toEqual(["compute-scores"]);
    expect(summary.staleJobs).toContain("sync-tier-2");
    expect(summary.staleJobs).toContain("sync-tier-3");
    expect(summary.staleJobs).toContain("sync-tier-4");
    expect(summary.recentFailures24h).toBe(1);
  });
});
