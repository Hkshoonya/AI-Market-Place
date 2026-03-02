/**
 * Cron run tracker.
 *
 * Wraps cron route handlers to automatically record each invocation
 * in the `cron_runs` table, capturing start/end times, status, and
 * result summaries.
 *
 * Usage:
 *   import { trackCronRun } from "@/lib/cron-tracker";
 *
 *   // Inside your cron GET handler:
 *   const tracker = await trackCronRun("compute-scores");
 *   try {
 *     // ... do work ...
 *     return tracker.complete({ scored: 958, ranked: 958 });
 *   } catch (err) {
 *     return tracker.fail(err);
 *   }
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { systemLog } from "@/lib/logging";

export interface CronTracker {
  /** Mark the run as completed. Returns a NextResponse with the result. */
  complete: (result: Record<string, unknown>) => Promise<NextResponse>;
  /** Mark the run as failed. Returns a 500 NextResponse. */
  fail: (err: unknown) => Promise<NextResponse>;
  /** The cron_runs row id (uuid). */
  runId: string | null;
}

/**
 * Start tracking a cron run. Creates a `cron_runs` row with status = 'running'.
 */
export async function trackCronRun(jobName: string): Promise<CronTracker> {
  const startedAt = new Date().toISOString();
  let runId: string | null = null;

  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data, error } = await sb
      .from("cron_runs")
      .insert({
        job_name: jobName,
        status: "running",
        started_at: startedAt,
      })
      .select("id")
      .single();

    if (!error && data) {
      runId = data.id;
    } else {
      console.error("[cron-tracker] Failed to create cron_runs row:", error?.message);
    }
  } catch (err) {
    console.error("[cron-tracker] Exception creating cron_runs row:", err);
  }

  return {
    runId,

    complete: async (result: Record<string, unknown>) => {
      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

      if (runId) {
        try {
          const supabase = createAdminClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any;
          await sb
            .from("cron_runs")
            .update({
              status: "completed",
              finished_at: finishedAt,
              duration_ms: durationMs,
              result_summary: result,
            })
            .eq("id", runId);
        } catch (err) {
          console.error("[cron-tracker] Failed to update cron_runs:", err);
        }
      }

      await systemLog.info(jobName, `Cron job completed in ${durationMs}ms`, {
        runId,
        durationMs,
        ...result,
      });

      return NextResponse.json({ ok: true, runId, durationMs, ...result });
    },

    fail: async (err: unknown) => {
      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (runId) {
        try {
          const supabase = createAdminClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any;
          await sb
            .from("cron_runs")
            .update({
              status: "failed",
              finished_at: finishedAt,
              duration_ms: durationMs,
              error_message: errorMessage,
            })
            .eq("id", runId);
        } catch (updateErr) {
          console.error("[cron-tracker] Failed to update cron_runs:", updateErr);
        }
      }

      await systemLog.error(jobName, `Cron job failed: ${errorMessage}`, {
        runId,
        durationMs,
      });

      return NextResponse.json(
        { ok: false, error: errorMessage, runId },
        { status: 500 }
      );
    },
  };
}
