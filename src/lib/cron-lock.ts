import { createAdminClient } from "@/lib/supabase/admin";
import { createTaggedLogger } from "@/lib/logging";
import { isRuntimeFlagEnabled } from "@/lib/runtime-flags";

const log = createTaggedLogger("cron-lock");
const DEFAULT_TTL_SECONDS = 900;

export interface CronLockHandle {
  acquired: boolean;
  mode: "disabled" | "locked" | "unavailable";
  token: string | null;
  release: () => Promise<void>;
}

function getLockTtlSeconds(): number {
  const raw = process.env.CRON_LOCK_TTL_SECONDS;
  if (!raw) {
    return DEFAULT_TTL_SECONDS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 30) {
    return DEFAULT_TTL_SECONDS;
  }

  return parsed;
}

export async function acquireCronLock(jobName: string): Promise<CronLockHandle> {
  if (!isRuntimeFlagEnabled("CRON_SINGLE_RUN_LOCK", true)) {
    return {
      acquired: true,
      mode: "disabled",
      token: null,
      release: async () => {},
    };
  }

  const token = crypto.randomUUID();
  const ttlSeconds = getLockTtlSeconds();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("acquire_cron_lock" as never, {
      p_job_name: jobName,
      p_lock_token: token,
      p_ttl_seconds: ttlSeconds,
    } as never);

    if (error) {
      await log.warn("Cron lock unavailable; continuing without single-run guard", {
        jobName,
        error: error.message,
      });
      return {
        acquired: true,
        mode: "unavailable",
        token: null,
        release: async () => {},
      };
    }

    if (!data) {
      return {
        acquired: false,
        mode: "locked",
        token: null,
        release: async () => {},
      };
    }

    return {
      acquired: true,
      mode: "locked",
      token,
      release: async () => {
        try {
          const releaseResult = await supabase.rpc("release_cron_lock" as never, {
            p_job_name: jobName,
            p_lock_token: token,
          } as never);

          if (releaseResult.error) {
            await log.warn("Failed to release cron lock", {
              jobName,
              error: releaseResult.error.message,
            });
          }
        } catch (error) {
          await log.warn("Cron lock release threw an exception", {
            jobName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
  } catch (error) {
    await log.warn("Cron lock helper threw; continuing without single-run guard", {
      jobName,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      acquired: true,
      mode: "unavailable",
      token: null,
      release: async () => {},
    };
  }
}
