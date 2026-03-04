# Phase 7: Error Handling + Logging - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate silent catch blocks, standardize API error responses via ApiError, replace console.error/warn with structured logging, and ensure client components surface errors visibly. Pure error-handling and logging cleanup — no new features, no behavior changes beyond making errors visible.

</domain>

<decisions>
## Implementation Decisions

### Silent Catch Handling
- Claude's discretion on per-call-site handling based on business impact
- Tiered approach: critical paths (sync, payments) get systemLog.error; non-critical (view tracking, PWA) get console.warn; cosmetic can stay lighter
- Sync orchestrator's recordSyncFailure/Success .catch() — Claude decides based on recursive failure risk (systemLog already has console fallback)
- Client-side silent catches (view-tracker, top-movers, market-ticker, pwa-register) — Claude picks simplest approach satisfying ERR-01
- Lint rule for preventing future silent catches — Claude decides based on practicality

### API Error Response Shape
- Claude decides the response shape balancing simplicity with debuggability
- handleApiError() should both log and return response — Claude decides the integration approach to reduce per-route boilerplate
- All 33+ API routes should be migrated for full consistency (ERR-02 requires this)
- Error details in production — Claude picks the secure default (likely hide internals, rely on server-side logs)

### Client Error UX
- Claude decides the UX pattern (toasts, inline, both) based on existing component structure
- Error boundaries vs component-level handling — Claude picks based on ERR-03 requirements and existing patterns
- Error message detail level — Claude decides per component based on user context
- Admin vs public-facing pages — Claude decides based on audience differences

### Claude's Discretion
- All four areas are fully delegated to Claude's judgment
- Key constraint: every silent catch must get at minimum some form of logging (ERR-01)
- Every API route must use consistent error pattern (ERR-02)
- Every client component must surface errors visually (ERR-03)
- All console.error/warn in src/lib/ replaced with structured logger (LOG-01)
- All API routes use structured logging with request context (LOG-02)
- All cron/adapter log calls use tagged loggers with source ID (LOG-03)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/logging.ts`: systemLog with info/warn/error — writes to system_logs table + console mirror fallback. Only 4 usages currently.
- `src/lib/api-error.ts`: ApiError class (statusCode + message) + handleApiError() helper. Exists but 0 API routes use it.
- Supabase `system_logs` table already exists with level, source, message, metadata columns.

### Established Patterns
- systemLog takes (source: string, message: string, metadata?: Record<string, unknown>) — source is free-form string
- handleApiError() returns Response.json({ error: message }, { status }) — simple shape
- Client components use bare `catch {}` or `catch { }` blocks with no error state

### Integration Points
- 32 console.error/warn calls in src/lib/ need migration to systemLog
- 28 console.error/warn calls in API routes need migration
- ~6 silent .catch(() => {}) handlers across components and orchestrator
- 33+ API routes need handleApiError() adoption
- Admin pages (agents, data-sources, listings, verifications) have bare catch blocks
- Marketplace pages (auctions, purchase) have similar patterns

### Quantified Scope
- Silent catches to fix: ~6 (4 client, 2 orchestrator)
- API routes to migrate: 33+ route files
- console.* to replace: 60 total (32 lib + 28 routes)
- Client components with bare catches: 15+ files

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user delegated all implementation decisions to Claude's judgment. Key constraint is satisfying ERR-01/02/03 and LOG-01/02/03 requirements.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-error-handling-logging*
*Context gathered: 2026-03-04*
