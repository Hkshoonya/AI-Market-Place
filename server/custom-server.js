/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
/**
 * AI Market Cap — Production Server Entrypoint
 *
 * Combines Next.js standalone server with node-cron in-process scheduling.
 * Uses startServer() — the same approach as .next/standalone/server.js —
 * to avoid loading webpack (which isn't in the standalone output).
 *
 * Instrumentation (validatePipelineSecrets + seedDataSources) runs automatically
 * via Next.js instrumentation hook before any requests.
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

// ── Global error handlers ────────────────────────────────────────────────────

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
});

// ── Load standalone config ───────────────────────────────────────────────────
// Read the config that next build wrote, then set the env var that Next.js
// standalone mode reads — exactly like .next/standalone/server.js does.

const requiredServerFilesPath = path.join(dir, ".next", "required-server-files.json");
const { config: nextConfig } = JSON.parse(fs.readFileSync(requiredServerFilesPath, "utf8"));

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

// ── Cron scheduler ───────────────────────────────────────────────────────────

function startCronScheduler() {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn(
      "[cron] CRON_SECRET not set — skipping cron scheduler."
    );
    return;
  }

  for (const job of CRON_JOBS) {
    cron.schedule(
      job.cron,
      async () => {
        console.log("[cron] Starting:", job.name);
        try {
          const response = await fetch(
            `http://localhost:${port}${job.path}`,
            {
              headers: { Authorization: `Bearer ${cronSecret}` },
              signal: AbortSignal.timeout(600_000),
            }
          );
          console.log(
            `[cron] Finished: ${job.name} -> HTTP ${response.status}`
          );
        } catch (err) {
          console.error(`[cron] Error running ${job.name}:`, err);
        }
      },
      { timezone: "UTC" }
    );
  }

  console.log(`[cron] ${CRON_JOBS.length} jobs scheduled`);
}

// ── Next.js server startup ───────────────────────────────────────────────────
// Use startServer() — the same internal API that the standalone server.js and
// `next start` both use. This avoids loading webpack/config-utils.

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
