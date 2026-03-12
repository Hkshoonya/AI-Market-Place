---
phase: 20
slug: pipeline-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (projects: unit/component) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `vitest run --project unit` |
| **Full suite command** | `vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `vitest run --project unit`
- **After every plan wave:** Run `vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 0 | PIPE-01 | unit | `vitest run --project unit src/lib/data-sources/seeder.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 0 | PIPE-02 | unit | `vitest run --project unit src/lib/data-sources/utils.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 0 | PIPE-04 | unit | `vitest run --project unit src/lib/pipeline/startup.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-04 | 01 | 0 | PIPE-03 | unit | `vitest run --project unit src/app/api/cron/sync/route.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-05 | 01 | 0 | PIPE-05 | unit | `vitest run --project unit src/lib/data-sources/utils.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-06 | 01 | 0 | PIPE-06 | unit | `vitest run --project unit src/lib/data-sources/shared/adapter-syncer.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-07 | 01 | 0 | PIPE-07 | unit | `vitest run --project unit src/app/api/pipeline/health/route.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/data-sources/seeder.test.ts` — stubs for PIPE-01 (seedDataSources insert-only, skip existing, fail on missing table)
- [ ] `src/lib/data-sources/utils.test.ts` — stubs for PIPE-02, PIPE-05 (resolveSecrets {secrets, missing} return + fetchWithRetry backoff)
- [ ] `src/lib/pipeline/startup.test.ts` — stubs for PIPE-04 (validatePipelineSecrets core vs adapter, process.exit on missing core)
- [ ] `src/app/api/cron/sync/route.test.ts` — stubs for PIPE-03 (response body includes sourcesFailed + per-adapter errors)
- [ ] `src/lib/data-sources/shared/adapter-syncer.test.ts` — stubs for PIPE-06 (healthCheck with/without API key)
- [ ] `src/app/api/pipeline/health/route.test.ts` — stubs for PIPE-07 (public summary vs authed detail, status determination)

**Vitest mock pattern (follows existing codebase):**
```typescript
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() }))
  }))
}));
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Startup exits on missing SUPABASE_URL | PIPE-04 | process.exit in instrumentation.ts can't be E2E tested | 1. Remove SUPABASE_URL from .env 2. Run `next dev` 3. Verify error log + exit |
| Sentry alert after 3 consecutive failures | PIPE-03 | Requires Sentry integration | Trigger 3 sync failures, verify Sentry dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
