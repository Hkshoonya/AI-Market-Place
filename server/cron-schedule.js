/**
 * AI Market Cap - Internal Cron Schedule Compatibility Layer
 *
 * These jobs only run when CRON_RUNNER_MODE resolves to "internal".
 * The schedule list is shared with the Cloudflare dispatcher so both
 * internal and external schedulers trigger the same routes.
 *
 * @type {Array<{ name: string, cron: string, path: string }>}
 */
const CRON_JOBS = require("../config/cron-jobs.json");

module.exports = { CRON_JOBS };
