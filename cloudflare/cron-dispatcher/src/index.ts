import {
  CRON_JOBS,
  dueJobsForTime,
  type CronJobDefinition,
} from "./schedule";

interface Env {
  CRON_SECRET: string;
  TARGET_BASE_URL: string;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface HealthSnapshot {
  status?: string;
  release?: {
    commitSha?: string | null;
    branch?: string | null;
    environment?: string | null;
  };
  cron?: {
    mode?: string | null;
    schedulerConfigured?: boolean;
    lastRunAt?: string | null;
  };
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function buildTargetUrl(env: Env, path: string) {
  return `${normalizeBaseUrl(env.TARGET_BASE_URL)}${path}`;
}

async function dispatchJob(job: CronJobDefinition, at: Date, env: Env) {
  const targetUrl = buildTargetUrl(env, job.path);
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "User-Agent": "aimarketcap-cron-dispatcher/1.0",
      "X-AIMC-Cron-Job": job.name,
      "X-AIMC-Scheduled-Time": at.toISOString(),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${job.name} -> HTTP ${response.status} from ${targetUrl}: ${body.slice(0, 300)}`
    );
  }

  return {
    name: job.name,
    path: job.path,
    status: response.status,
    targetUrl,
  };
}

async function dispatchJobs(jobs: CronJobDefinition[], at: Date, env: Env) {
  const startedAt = Date.now();
  const settled = await Promise.allSettled(
    jobs.map(async (job) => dispatchJob(job, at, env))
  );

  const results = settled.map((result, index) => {
    const job = jobs[index];
    if (result.status === "fulfilled") {
      return { job: job.name, ok: true, ...result.value };
    }

    return {
      job: job.name,
      ok: false,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      path: job.path,
    };
  });

  const failed = results.filter((result) => !result.ok);
  const summary = {
    scheduledTime: at.toISOString(),
    attempted: jobs.length,
    failed: failed.length,
    durationMs: Date.now() - startedAt,
    results,
  };

  if (failed.length > 0) {
    console.error("Cron dispatch encountered failures", summary);
  } else {
    console.log("Cron dispatch completed", summary);
  }

  return summary;
}

async function fetchTargetHealth(env: Env): Promise<HealthSnapshot | null> {
  const response = await fetch(buildTargetUrl(env, "/api/health"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "User-Agent": "aimarketcap-cron-dispatcher/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as HealthSnapshot;
  return body;
}

async function dispatchDueJobs(at: Date, env: Env) {
  const health = await fetchTargetHealth(env);
  if (health?.cron?.mode !== "external") {
    const summary = {
      scheduledTime: at.toISOString(),
      attempted: 0,
      failed: 0,
      durationMs: 0,
      skipped: true,
      reason: "target_cron_mode_not_external",
      targetCronMode: health?.cron?.mode ?? null,
      targetRelease: health?.release?.commitSha ?? null,
      results: [],
    };
    console.log("Cron dispatch skipped because target app has not cut over yet", summary);
    return summary;
  }

  const jobs = dueJobsForTime(at);
  if (jobs.length === 0) {
    const summary = {
      scheduledTime: at.toISOString(),
      attempted: 0,
      failed: 0,
      durationMs: 0,
      results: [],
    };
    console.log("No cron jobs due at scheduled tick", summary);
    return summary;
  }

  return dispatchJobs(jobs, at, env);
}

function isAuthorized(request: Request, env: Env) {
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

async function handleManualRun(request: Request, env: Env) {
  if (!isAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedJob = url.searchParams.get("job");
  const at = new Date(url.searchParams.get("at") ?? Date.now());
  if (Number.isNaN(at.getTime())) {
    return Response.json({ error: "Invalid at timestamp" }, { status: 400 });
  }

  const jobs = requestedJob
    ? CRON_JOBS.filter(
        (job) => job.name === requestedJob || job.path === requestedJob
      )
    : dueJobsForTime(at);

  if (requestedJob && jobs.length === 0) {
    return Response.json(
      { error: `Unknown cron job: ${requestedJob}` },
      { status: 404 }
    );
  }

  const summary = await dispatchJobs(jobs, at, env);
  return Response.json(summary, {
    status: summary.failed > 0 ? 500 : 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

const cronDispatcher = {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: WorkerExecutionContext
  ) {
    const scheduledAt = new Date(controller.scheduledTime);
    ctx.waitUntil(dispatchDueJobs(scheduledAt, env));
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/run") {
      return handleManualRun(request, env);
    }

    const now = new Date();
    return Response.json(
      {
        service: "aimarketcap-cron-dispatcher",
        targetBaseUrl: normalizeBaseUrl(env.TARGET_BASE_URL),
        triggerCron: "*/5 * * * *",
        knownJobs: CRON_JOBS.length,
        dueNow: dueJobsForTime(now).map((job) => ({
          name: job.name,
          path: job.path,
          cron: job.cron,
        })),
        manualRunEndpoint: "/run",
        manualRunAuth: "Bearer CRON_SECRET",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  },
};

export default cronDispatcher;
