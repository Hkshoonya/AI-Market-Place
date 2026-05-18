/**
 * AI Market Cap - Internal Cron Schedule Compatibility Layer
 *
 * These jobs only run when CRON_RUNNER_MODE resolves to "internal".
 * The schedule list is shared with the Cloudflare dispatcher so both
 * internal and external schedulers trigger the same routes.
 *
 * @type {Array<{ name: string, cron: string, path: string }>}
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS server code reads a shared JSON schedule.
const CRON_JOBS = require("../config/cron-jobs.json");

module.exports = { CRON_JOBS };
