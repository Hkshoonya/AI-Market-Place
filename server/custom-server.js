/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
/**
 * AI Market Cap - Production Server Entrypoint
 *
 * Combines Next.js standalone server with optional node-cron in-process scheduling.
 * External cron is the default for non-Railway deployments.
 */

const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const { CRON_JOBS } = require("./cron-schedule.js");

const dir = path.join(__dirname, "..");
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

process.env.NODE_ENV = "production";
process.chdir(dir);

function isTruthy(value) {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function resolveCronRunnerMode() {
  const rawMode = (process.env.CRON_RUNNER_MODE || "").trim().toLowerCase();

  if (
    rawMode === "disabled" ||
    rawMode === "internal" ||
    rawMode === "external"
  ) {
    return rawMode;
  }

  const isRailway = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_STATIC_URL
  );

  return isRailway ? "internal" : "external";
}

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
});

const requiredServerFilesPath = path.join(
  dir,
  ".next",
  "required-server-files.json"
);
const { config: nextConfig } = JSON.parse(
  fs.readFileSync(requiredServerFilesPath, "utf8")
);

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

function startCronScheduler() {
  const cronMode = resolveCronRunnerMode();
  const hasExplicitCronMode = Boolean(
    (process.env.CRON_RUNNER_MODE || "").trim()
  );
  const shouldRunInProcess =
    cronMode === "internal" ||
    (!hasExplicitCronMode && isTruthy(process.env.ENABLE_IN_PROCESS_CRON));

  if (!shouldRunInProcess) {
    console.log(
      `[cron] In-process scheduler disabled (mode: ${cronMode}); expecting external cron to call /api/cron/*.`
    );
    return;
  }

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("[cron] CRON_SECRET not set - skipping cron scheduler.");
    return;
  }

  for (const job of CRON_JOBS) {
    cron.schedule(
      job.cron,
      async () => {
        console.log("[cron] Starting:", job.name);
        try {
          const response = await fetch(`http://localhost:${port}${job.path}`, {
            headers: { Authorization: `Bearer ${cronSecret}` },
            signal: AbortSignal.timeout(600_000),
          });
          console.log(`[cron] Finished: ${job.name} -> HTTP ${response.status}`);
        } catch (err) {
          console.error(`[cron] Error running ${job.name}:`, err);
        }
      },
      { timezone: "UTC" }
    );
  }

  console.log(`[cron] ${CRON_JOBS.length} jobs scheduled`);
}

require("next");
const { startServer } = require("next/dist/server/lib/start-server");

console.log(`[server] Starting on http://${hostname}:${port}`);

startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port,
  allowRetry: false,
})
  .then(() => {
    console.log(`[server] Ready on http://${hostname}:${port}`);
    startCronScheduler();
  })
  .catch((err) => {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  });
