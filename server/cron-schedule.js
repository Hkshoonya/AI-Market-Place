/**
 * AI Market Cap - Internal Cron Schedule Compatibility Layer
 *
 * These jobs only run when CRON_RUNNER_MODE resolves to "internal".
 * External VPS cron is the deployment default; Railway remains a supported
 * compatibility path for environments that still rely on in-process scheduling.
 *
 * @type {Array<{ name: string, cron: string, path: string }>}
 */
const CRON_JOBS = [
  { name: "Tier 1 Sync", cron: "0 */2 * * *", path: "/api/cron/sync?tier=1" },
  { name: "Tier 2 Sync", cron: "0 */4 * * *", path: "/api/cron/sync?tier=2" },
  { name: "Tier 3 Sync", cron: "0 */8 * * *", path: "/api/cron/sync?tier=3" },
  { name: "Tier 4 Sync", cron: "0 0 * * *", path: "/api/cron/sync?tier=4" },
  {
    name: "Auction Settlement",
    cron: "*/5 * * * *",
    path: "/api/cron/auctions",
  },
  {
    name: "Compute Scores",
    cron: "45 */2 * * *",
    path: "/api/cron/compute-scores",
  },
  {
    name: "Social Signal Publisher",
    cron: "55 */2 * * *",
    path: "/api/cron/social/publish-signals",
  },
  {
    name: "Pipeline Agent",
    cron: "30 */2 * * *",
    path: "/api/cron/agents/pipeline",
  },
  {
    name: "Code Quality",
    cron: "0 9 * * *",
    path: "/api/cron/agents/code-quality",
  },
  {
    name: "UX Monitor",
    cron: "0 10 * * 1",
    path: "/api/cron/agents/ux-monitor",
  },
  {
    name: "Verifier Agent",
    cron: "15 */4 * * *",
    path: "/api/cron/agents/verifier",
  },
];

module.exports = { CRON_JOBS };
