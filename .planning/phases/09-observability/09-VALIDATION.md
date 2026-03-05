---
phase: 9
slug: observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | OBS-01, OBS-05 | build + typecheck | `npx tsc --noEmit` | existing | pending |
| 09-01-02 | 01 | 1 | OBS-02 | build | `npm run build` | existing | pending |
| 09-02-01 | 02 | 1 | OBS-03 | build + typecheck | `npx tsc --noEmit` | existing | pending |
| 09-02-02 | 02 | 1 | OBS-04 | build + typecheck | `npx tsc --noEmit` | existing | pending |
| 09-03-01 | 03 | 2 | PERF-03 | manual | bundle size check after build | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — phase is infrastructure/configuration work validated by build success and typecheck.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Errors appear in Sentry dashboard | OBS-01 | External service verification | Trigger a 5xx error, check Sentry dashboard for entry with readable stack trace |
| Source maps produce readable traces | OBS-02 | Requires deployed build + Sentry UI | Deploy, trigger error, verify stack trace shows original TypeScript not minified JS |
| Page views appear in PostHog | OBS-03 | External service verification | Navigate 3+ pages, check PostHog dashboard for pageview events |
| Custom events fire on actions | OBS-04 | External service verification | View a model, switch lens, check PostHog for model_viewed and lens_switched events |
| No CSP violations | OBS-05 | Browser console check | Open app, check browser console for Content-Security-Policy violations |
| Bundle size under budget | PERF-03 | Build output comparison | Run `npm run build`, compare .next output sizes before/after |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
