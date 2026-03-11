---
phase: 15
slug: e2e-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | @playwright/test 1.50+ |
| **Config file** | `playwright.config.ts` (Wave 0 — must be created) |
| **Quick run command** | `npx playwright test --project=chromium-desktop e2e/auth.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~120 seconds (including webServer startup) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=chromium-desktop <relevant-spec.ts>`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | E2E-01 | smoke | `npx playwright test --project=chromium-desktop --grep "smoke"` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | E2E-02 | e2e | `npx playwright test e2e/auth.spec.ts` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 1 | E2E-03 | e2e | `npx playwright test e2e/model-detail.spec.ts` | ❌ W0 | ⬜ pending |
| 15-04-01 | 04 | 1 | E2E-04 | e2e | `npx playwright test e2e/leaderboard.spec.ts` | ❌ W0 | ⬜ pending |
| 15-05-01 | 05 | 1 | E2E-05 | e2e | `npx playwright test e2e/marketplace.spec.ts` | ❌ W0 | ⬜ pending |
| 15-06-01 | 06 | 2 | E2E-06 | integration | CI pipeline (GitHub Actions) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — Playwright config with webServer, projects, retries
- [ ] `e2e/fixtures/models.json` — shared fixture for E2E-03
- [ ] `e2e/fixtures/leaderboard.json` — shared fixture for E2E-04
- [ ] `e2e/fixtures/listings.json` — shared fixture for E2E-05
- [ ] `e2e/helpers/auth.ts` — `injectMockAuth()` helper for E2E-02
- [ ] `e2e/helpers/routes.ts` — `mockSupabaseTable()` helper for E2E-03/04/05
- [ ] `npm install --save-dev @playwright/test` — framework install
- [ ] `npx playwright install chromium firefox` — browser binaries

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E job blocks PR merge | E2E-06 | Requires GitHub branch protection rule config | Set e2e as required check in repo settings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
