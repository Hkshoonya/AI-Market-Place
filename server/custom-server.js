"use strict";
/**
 * AI Market Cap — Production Server Entrypoint
 *
 * Combines Next.js server with node-cron in-process scheduling.
 * Works in both Railpack mode (full project) and Dockerfile standalone mode.
 *
 * Instrumentation (validatePipelineSecrets + seedDataSources) runs automatically
 * via Next.js instrumentation hook during app.prepare() — no replication here.
 */

const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");
const cron = require("node-cron");
const { CRON_JOBS } = require("./cron-schedule.js");

const dir = path.join(__dirname, "..");
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

process.chdir(dir);

// ── Global error handlers ────────────────────────────────────────────────────

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
});

// ── Cron scheduler ───────────────────────────────────────────────────────────

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

const next = require("next");
const app = next({ dev: false, hostname, port, dir });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.log(`[server] Ready on http://${hostname}:${port}`);
      startCronScheduler();
    });
  })
  .catch((err) => {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  });
