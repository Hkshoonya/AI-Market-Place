---
phase: 22-railway-deployment
plan: 02
subsystem: infra
tags: [node-cron, docker, railway, custom-server, cron-jobs, standalone]

# Dependency graph
requires:
  - phase: 22-railway-deployment
    provides: Railway deployment context and environment variable requirements

provides:
  - server/custom-server.js — combined Next.js standalone + node-cron entrypoint
  - server/cron-schedule.js — config-driven array of 8 cron job definitions
  - Dockerfile updated to use custom-server.js as CMD
  - node-cron installed as production dependency

affects: [23-cloudflare-dns, deployment, cron-scheduling]

# Tech tracking
tech-stack:
  added: [node-cron ^4.2.1]
  patterns:
    - Custom server pattern combining Next.js app.prepare() with HTTP createServer and node-cron scheduler
    - HTTP self-call pattern for cron jobs (localhost Bearer CRON_SECRET) reusing existing route handlers
    - CommonJS modules for server/ directory (matches Next.js standalone output format)

key-files:
  created:
    - server/custom-server.js
    - server/cron-schedule.js
  modified:
    - Dockerfile
    - .dockerignore
    - package.json
    - package-lock.json

key-decisions:
  - "server/ directory uses CommonJS (module.exports) to match Next.js standalone server.js format"
  - "CRON_SECRET absence skips cron setup but server still serves HTTP requests (graceful degradation)"
  - "AbortSignal.timeout(600_000) replaces curl --max-time 600 from cron-jobs.sh"
  - "node-cron module copied explicitly to runner stage since standalone prunes node_modules"
  - ".planning/ added to .dockerignore to reduce Docker build context"

patterns-established:
  - "In-process cron: startCronScheduler() called inside .listen() callback after server is ready"
  - "All cron jobs use UTC timezone option for schedule consistency across deployments"

requirements-completed: [DEPL-01, DEPL-03]

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 22 Plan 02: Custom Server Entrypoint Summary

**node-cron in-process scheduler embedded in Next.js standalone server — 8 cron jobs make HTTP self-calls with Bearer CRON_SECRET, replacing the shell-based cron-jobs.sh**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-12T04:52:27Z
- **Completed:** 2026-03-12T05:07:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `server/custom-server.js` — single entrypoint Railway runs via `node server/custom-server.js`
- Created `server/cron-schedule.js` — config-driven array matching all 8 schedules from cron-jobs.sh exactly
- Dockerfile updated: server/ + node-cron copied to runner stage, CMD updated, build args comment updated
- node-cron ^4.2.1 added as production dependency

## Task Commits

Each task was committed atomically:

1. **Task 1: Install node-cron and create cron schedule config** - `ddc39da` (feat)
2. **Task 2: Create custom-server.js and update Dockerfile** - `9086630` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `server/custom-server.js` - Production entrypoint: Next.js standalone server + node-cron scheduler in one process
- `server/cron-schedule.js` - Config array of 8 cron job definitions (name, cron expression, API path)
- `Dockerfile` - Copies server/ + node-cron to runner stage; CMD uses custom-server.js; build args comment updated to Railway
- `.dockerignore` - Added .planning/ to reduce build context size
- `package.json` - Added node-cron ^4.2.1 as production dependency
- `package-lock.json` - Updated lockfile

## Decisions Made

- CommonJS (module.exports) used for server/ files because Next.js standalone server.js is CommonJS
- CRON_SECRET missing skips cron setup but server still starts — prevents Railway restart loops if secret not yet set
- `AbortSignal.timeout(600_000)` mirrors `curl --max-time 600` from cron-jobs.sh (10 minute limit)
- node-cron module explicitly COPY'd to runner stage because Next.js standalone output prunes node_modules to only what the Next.js app requires, leaving node-cron out
- `.planning/` added to .dockerignore — planning files have no place in production Docker context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. CRON_SECRET env var on Railway is handled in a separate env-vars plan.

## Next Phase Readiness

- custom-server.js and Dockerfile ready for Railway service deployment
- Next plan should configure Railway environment variables and deploy service
- Lint errors in pre-existing test files (route.test.ts) are out of scope — not caused by this plan

---
*Phase: 22-railway-deployment*
*Completed: 2026-03-12*
