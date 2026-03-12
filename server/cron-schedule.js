/**
 * AI Market Cap — Cron Schedule Configuration
 *
 * Defines all 8 cron jobs that run inside the production server process.
 * Schedules match exactly the crontab entries in scripts/cron-jobs.sh.
 *
 * @type {Array<{ name: string, cron: string, path: string }>}
 */
const CRON_JOBS = [
  { name: "Tier 1 Sync",    cron: "0 */6 * * *",   path: "/api/cron/sync?tier=1" },
  { name: "Tier 2 Sync",    cron: "0 */12 * * *",  path: "/api/cron/sync?tier=2" },
  { name: "Tier 3 Sync",    cron: "0 8 * * *",     path: "/api/cron/sync?tier=3" },
  { name: "Tier 4 Sync",    cron: "0 0 * * 1",     path: "/api/cron/sync?tier=4" },
  { name: "Pipeline Agent", cron: "30 */6 * * *",  path: "/api/cron/agents/pipeline" },
  { name: "Code Quality",   cron: "0 9 * * *",     path: "/api/cron/agents/code-quality" },
  { name: "UX Monitor",     cron: "0 10 * * 1",    path: "/api/cron/agents/ux-monitor" },
  { name: "Compute Scores", cron: "45 */6 * * *",  path: "/api/cron/compute-scores" },
];

module.exports = { CRON_JOBS };
