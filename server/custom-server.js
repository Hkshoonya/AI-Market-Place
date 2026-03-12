"use strict";
/**
 * AI Market Cap — Production Server Entrypoint
 *
 * Combines Next.js standalone server with node-cron in-process scheduling.
 * Railway runs this as the single process: CMD ["node", "server/custom-server.js"]
 *
 * Uses the same startServer() approach as the Next.js standalone server.js
 * to ensure proper standalone mode initialization.
 *
 * Instrumentation (validatePipelineSecrets + seedDataSources) runs automatically
 * via Next.js instrumentation hook before any requests — no replication needed here.
 */

const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const { CRON_JOBS } = require("./cron-schedule.js");

const dir = path.join(__dirname, "..");
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

// ── Global error handlers — log and continue, Railway restarts on crash ──────

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
});

// ── Load Next.js standalone config ───────────────────────────────────────────
// The standalone build writes required-server-files.json with the full
// nextConfig. We must set __NEXT_PRIVATE_STANDALONE_CONFIG before requiring
// next, exactly like the generated .next/standalone/server.js does.

const requiredServerFilesPath = path.join(dir, ".next", "required-server-files.json");
const { config: nextConfig } = JSON.parse(fs.readFileSync(requiredServerFilesPath, "utf8"));

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);
process.env.NODE_ENV = "production";
process.chdir(dir);

// ── Cron scheduler ────────────────────────────────────────────────────────────

/**
 * Starts all cron jobs defined in cron-schedule.js.
 * Each job makes an HTTP self-call to the corresponding API route using
 * Bearer CRON_SECRET authentication — reusing existing route handlers.
 *
 * If CRON_SECRET is not set, cron setup is skipped (server still serves requests).
 */
function startCronScheduler() {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn(
      "[cron] CRON_SECRET not set — skipping cron scheduler. Set CRON_SECRET to enable scheduled jobs."
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
              signal: AbortSignal.timeout(600_000), // 10 minute timeout
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

// ── Next.js server startup ────────────────────────────────────────────────────
// Use startServer() — the same approach as the Next.js standalone server.js.
// This handles config loading, instrumentation, and HTTP listener creation.

require("next");
const { startServer } = require("next/dist/server/lib/start-server");

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
