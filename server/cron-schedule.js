/**
 * AI Market Cap — Cron Schedule Configuration (Primary Layer)
 *
 * Runs in-process via node-cron on Railway.
 * GitHub Actions runs the same jobs at staggered times for double coverage.
 *
 * Combined coverage with GitHub Actions backup:
 *   Tier 1 Sync:     every hour     (node-cron even hours, GH odd hours)
 *   Tier 2 Sync:     every 2 hours  (node-cron 0,4,8…, GH 2,6,10…)
 *   Tier 3 Sync:     every 3 hours  (node-cron 0,6,12,18, GH 3,9,15,21)
 *   Tier 4 Sync:     twice daily    (node-cron 00:00, GH 12:00)
 *   Compute Scores:  every hour     (node-cron even :45, GH odd :45)
 *   Pipeline Agent:  every 2 hours  (node-cron 0,4,8…:30, GH 2,6,10…:30)
 *   Code Quality:    twice daily    (node-cron 09:00, GH 21:00)
 *   UX Monitor:      twice weekly   (node-cron Mon 10:00, GH Thu 22:00)
 *
 * @type {Array<{ name: string, cron: string, path: string }>}
 */
const CRON_JOBS = [
  { name: "Tier 1 Sync",    cron: "0 */2 * * *",   path: "/api/cron/sync?tier=1" },
  { name: "Tier 2 Sync",    cron: "0 */4 * * *",   path: "/api/cron/sync?tier=2" },
  { name: "Tier 3 Sync",    cron: "0 */6 * * *",   path: "/api/cron/sync?tier=3" },
  { name: "Tier 4 Sync",    cron: "0 0 * * *",     path: "/api/cron/sync?tier=4" },
  { name: "Compute Scores", cron: "45 */2 * * *",  path: "/api/cron/compute-scores" },
  { name: "Pipeline Agent", cron: "30 */4 * * *",  path: "/api/cron/agents/pipeline" },
  { name: "Code Quality",   cron: "0 9 * * *",     path: "/api/cron/agents/code-quality" },
  { name: "UX Monitor",     cron: "0 10 * * 1",    path: "/api/cron/agents/ux-monitor" },
];

module.exports = { CRON_JOBS };
