/**
 * Cron run tracker.
 *
 * Wraps cron route handlers to automatically record each invocation
 * in the `cron_runs` table, capturing start/end times, status, and
 * result summaries.
 */

import { NextResponse } from "next/server";
import { createTaggedLogger } from "@/lib/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import { acquireCronLock } from "@/lib/cron-lock";

const log = createTaggedLogger("cron-tracker");
const DEFAULT_STALE_AFTER_MS = 30 * 60 * 1000;

export interface CronTracker {
  /** Mark the run as completed. Returns a NextResponse with the result. */
  complete: (result: Record<string, unknown>) => Promise<NextResponse>;
  /** Mark the run as failed. Returns a 500 NextResponse. */
  fail: (err: unknown) => Promise<NextResponse>;
  /** Return a skip response when another run already owns the lock. */
  skip: (metadata?: Record<string, unknown>) => Promise<NextResponse>;
  /** The cron_runs row id (uuid). */
  runId: string | null;
  /** True when this invocation should return tracker.skip() immediately. */
  shouldSkip: boolean;
}

export interface TrackCronRunOptions {
  staleAfterMs?: number;
}

/**
 * Start tracking a cron run. Creates a `cron_runs` row with status = 'running'.
 */
export async function trackCronRun(
  jobName: string,
  options: TrackCronRunOptions = {}
): Promise<CronTracker> {
  const lock = await acquireCronLock(jobName);
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;

  if (!lock.acquired) {
    return {
      runId: null,
      shouldSkip: true,
      complete: async () =>
        NextResponse.json(
          { ok: true, skipped: true, reason: "already_running", jobName },
          { status: 202 }
        ),
      fail: async (err: unknown) =>
        NextResponse.json(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            skipped: true,
            reason: "already_running",
            jobName,
          },
          { status: 500 }
        ),
      skip: async (metadata: Record<string, unknown> = {}) =>
        NextResponse.json(
          {
            ok: true,
            skipped: true,
            reason: "already_running",
            jobName,
            ...metadata,
          },
          { status: 202 }
        ),
    };
  }

  const startedAt = new Date().toISOString();
  let runId: string | null = null;

  try {
    const supabase = createAdminClient();
    const staleCutoff = new Date(Date.now() - staleAfterMs).toISOString();

    try {
      await supabase
        .from("cron_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: `Marked stale before acquiring cron lock for ${jobName}`,
        })
        .eq("job_name", jobName)
        .eq("status", "running")
        .lt("started_at", staleCutoff);
    } catch (error) {
      await log.warn("Failed to mark stale cron runs", {
        jobName,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const { data, error } = await supabase
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
    } else if (error?.code === "23505") {
      await lock.release();
      return {
        runId: null,
        shouldSkip: true,
        complete: async () =>
          NextResponse.json(
            { ok: true, skipped: true, reason: "already_running", jobName },
            { status: 202 }
          ),
        fail: async (err: unknown) =>
          NextResponse.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              skipped: true,
              reason: "already_running",
              jobName,
            },
            { status: 500 }
          ),
        skip: async (metadata: Record<string, unknown> = {}) =>
          NextResponse.json(
            {
              ok: true,
              skipped: true,
              reason: "already_running",
              jobName,
              ...metadata,
            },
            { status: 202 }
          ),
      };
    } else {
      void log.error("Failed to create cron_runs row", { error: error?.message });
    }
  } catch (err) {
    void log.error("Exception creating cron_runs row", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    runId,
    shouldSkip: false,

    skip: async (metadata: Record<string, unknown> = {}) => {
      await lock.release();
      return NextResponse.json(
        { ok: true, skipped: true, jobName, ...metadata },
        { status: 202 }
      );
    },

    complete: async (result: Record<string, unknown>) => {
      const finishedAt = new Date().toISOString();
      const durationMs =
        new Date(finishedAt).getTime() - new Date(startedAt).getTime();

      try {
        if (runId) {
          try {
            const supabase = createAdminClient();
            await supabase
              .from("cron_runs")
              .update({
                status: "completed",
                finished_at: finishedAt,
                duration_ms: durationMs,
                result_summary: result,
              })
              .eq("id", runId);
          } catch (err) {
            void log.error("Failed to update cron_runs on complete", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        await log.info(`Cron job completed in ${durationMs}ms`, {
          runId,
          durationMs,
          ...result,
        });

        return NextResponse.json({ ok: true, runId, durationMs, ...result });
      } finally {
        await lock.release();
      }
    },

    fail: async (err: unknown) => {
      const finishedAt = new Date().toISOString();
      const durationMs =
        new Date(finishedAt).getTime() - new Date(startedAt).getTime();
      const errorMessage = err instanceof Error ? err.message : String(err);

      try {
        if (runId) {
          try {
            const supabase = createAdminClient();
            await supabase
              .from("cron_runs")
              .update({
                status: "failed",
                finished_at: finishedAt,
                duration_ms: durationMs,
                error_message: errorMessage,
              })
              .eq("id", runId);
          } catch (updateErr) {
            void log.error("Failed to update cron_runs on fail", {
              error:
                updateErr instanceof Error
                  ? updateErr.message
                  : String(updateErr),
            });
          }
        }

        await log.error(`Cron job failed: ${errorMessage}`, {
          runId,
          durationMs,
        });

        return NextResponse.json(
          { ok: false, error: errorMessage, runId },
          { status: 500 }
        );
      } finally {
        await lock.release();
      }
    },
  };
}
