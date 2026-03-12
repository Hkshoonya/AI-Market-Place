---
phase: 21
slug: admin-visibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest with React Testing Library |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | ADMN-01 | unit | `npx vitest run src/app/api/admin/sync/route.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | ADMN-02 | unit | `npx vitest run src/lib/pipeline-health-compute.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | ADMN-03 | unit | `npx vitest run src/app/api/admin/pipeline/health/route.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-04 | 01 | 1 | ADMN-04/05 | unit | `npx vitest run src/lib/format.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/admin/sync/route.test.ts` — covers ADMN-01 (source filter, limit param, auth check)
- [ ] `src/app/api/admin/pipeline/health/route.test.ts` — covers ADMN-03 (auth, admin check, payload shape)
- [ ] `src/lib/pipeline-health-compute.test.ts` — covers ADMN-02 (status computation, staleness sort)
- [ ] `src/lib/format.test.ts` — covers `formatRelativeTime` sub-day granularity
- [ ] Extract `computeStatus()` to `src/lib/pipeline-health-compute.ts` (shared between two routes + tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Expandable row expand/collapse animation | ADMN-01 | Visual/UX behavior | Click chevron → row expands with sync history, click again → collapses |
| Staleness row background tint (amber/red) | ADMN-02 | Visual styling | Verify degraded rows have amber tint, down rows have red tint |
| Sheet drawer slide-out from right | ADMN-04 | Visual/UX behavior | Click adapter name → drawer slides from right with detail view |
| Sync Now button spinner and auto-refresh | ADMN-05 | End-to-end interaction | Click "Sync Now" → spinner shows → drawer refreshes on completion |
| Pipeline status pill color coding | ADMN-03 | Visual styling | Verify pill is green/amber/red based on pipeline state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
