---
phase: 14
slug: swr-data-fetching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + Testing Library (jsdom) |
| **Config file** | `vitest.config.ts` (two projects: unit + component) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PERF-01 | unit | `npx vitest run` | Wave 0 (SWR config) | ⬜ pending |
| 14-02-01 | 02 | 2 | PERF-01 | component | `npx vitest run` | Existing (needs SWR wrap) | ⬜ pending |
| 14-03-01 | 03 | 2 | PERF-01 | component | `npx vitest run` | Existing (needs SWR wrap) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update existing component tests (market-ticker, search-dialog, comments-section, ranking-weight-controls, filter-bar) to wrap with `<SWRConfig value={{ provider: () => new Map() }}>` for test isolation
- [ ] `src/lib/swr/config.test.ts` — verify tier constants are well-typed
- [ ] Update `vi.stubGlobal('fetch')` mocks in existing tests to work with SWR's fetch timing

*SWR config and test isolation must be established before converting components.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cached data shown on page re-navigation | PERF-01 | Requires browser navigation and visual observation | Navigate to model page, navigate away, navigate back — data should appear instantly |
| Background revalidation visual | PERF-01 | Requires network tab observation | Open DevTools Network tab, navigate to page with SWR — see stale data rendered, then background fetch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
