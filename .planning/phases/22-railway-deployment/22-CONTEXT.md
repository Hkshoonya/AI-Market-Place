# Phase 22: Railway Deployment - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The app is live on Railway at aimarketcap.tech — deployed via git push to main, all 8 cron jobs running in-process via node-cron, environment fully configured, and HTTPS working end to end.

Requirements: DEPL-01, DEPL-02, DEPL-03, DEPL-04, DEPL-05

</domain>

<decisions>
## Implementation Decisions

### node-cron integration
- Custom server.js wrapper that imports Next.js standalone server AND starts node-cron schedules
- Dockerfile CMD becomes `node custom-server.js`
- Cron jobs invoke endpoints via HTTP self-call (`fetch('http://localhost:3000/api/cron/...')`) with Bearer CRON_SECRET — reuses all existing route handlers, auth, logging, and error handling
- No new logging code at wrapper level — existing CronTracker + systemLog in route handlers is sufficient; wrapper only logs startup confirmation
- Config-driven schedules: array of `{ name, cron, path }` objects for all 8 jobs — consistent with seed-config.ts pattern from Phase 20

### Dockerfile & build pipeline
- Reuse existing multi-stage Dockerfile — already produces standalone Next.js image
- Add custom-server.js and cron-scheduler to final stage, change CMD to `node custom-server.js`
- Deploy branch: main — push to main triggers Railway build and deploy
- SENTRY_AUTH_TOKEN set as Railway build-time variable — existing `ARG SENTRY_AUTH_TOKEN` in Dockerfile handles it
- No Dockerfile HEALTHCHECK — Railway uses TCP check on port 3000; /api/health is for external monitoring

### Health endpoint design
- `/api/health` returns extended response: status, version (package.json), uptime (`process.uptime()`), DB connectivity, cron scheduler status, and pipeline health summary counts
- Auth model: public request gets `{ status, version, timestamp }`; authenticated request (Bearer CRON_SECRET) adds DB, cron, pipeline details — matches `/api/pipeline/health` pattern
- Returns 503 only when DB is unreachable; degraded pipeline or cron returns 200 with `status: 'degraded'`
- Uptime tracked via `process.uptime()` — resets on deploy (correct behavior)

### DNS + SSL setup
- Domain: aimarketcap.tech (not .com)
- Cloudflare CNAME records pointing to Railway's provided domain (DNS-only, grey cloud — no Cloudflare proxy)
- Railway handles SSL via Let's Encrypt
- www.aimarketcap.tech redirects to apex via Next.js middleware (301 redirect)
- NEXT_PUBLIC_SITE_URL updated to https://aimarketcap.tech across entire codebase (code, config, docs)

### Claude's Discretion
- Exact custom-server.js implementation (import patterns, error handling for cron failures)
- node-cron package version choice
- Zod schema for health endpoint response
- Exact middleware.ts integration for www redirect (alongside existing middleware logic)
- Railway service configuration details (region, instance size)
- Whether to add a railway.json config file or use Railway dashboard settings

</decisions>

<specifics>
## Specific Ideas

- Domain is aimarketcap.tech — all references to aimarketcap.com need updating
- Cron schedule config should mirror the 8 entries from cron-jobs.sh (same intervals, same offsets)
- Health endpoint should follow the same auth pattern as /api/pipeline/health (Bearer CRON_SECRET for detailed response)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Dockerfile`: Multi-stage standalone build already works — just needs custom-server.js + cron-scheduler added to final stage
- `cron-jobs.sh`: Reference for all 8 cron job names, schedules, and API paths — translate to config-driven node-cron array
- `/api/pipeline/health/route.ts`: Auth pattern (Bearer CRON_SECRET for details, public for summary) — reuse for /api/health
- `next.config.ts`: Already has `output: "standalone"` configured
- `package.json`: Has `"start": "next start"` — custom-server.js replaces this for Railway

### Established Patterns
- `handleApiError` + `createTaggedLogger`: All 65 API routes use this — /api/health must follow
- Bearer CRON_SECRET auth: Used in all cron routes and /api/pipeline/health — /api/health uses same pattern for detailed response
- Zod `parseQueryResult`: Used at 62 call sites — health endpoint DB query should validate

### Integration Points
- `Dockerfile` CMD: Change from `node server.js` to `node custom-server.js`
- `middleware.ts`: Add www → apex redirect logic (check existing middleware for other matchers)
- `instrumentation.ts`: Already runs seedDataSources() and secret validation on startup — custom-server.js starts after this
- All `aimarketcap.com` references: Need global update to `aimarketcap.tech`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-railway-deployment*
*Context gathered: 2026-03-12*
