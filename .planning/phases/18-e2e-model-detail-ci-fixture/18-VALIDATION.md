---
phase: 18
slug: e2e-model-detail-ci-fixture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test e2e/model-detail.spec.ts --project=chromium-desktop` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/model-detail.spec.ts --project=chromium-desktop`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | E2E-03 | E2E infra | `npx playwright test e2e/model-detail.spec.ts --project=chromium-desktop` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | E2E-03 | E2E fixture | same | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | E2E-03 | E2E assertion | same | ✅ (needs modification) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/mocks/server.ts` — MSW setupServer export
- [ ] `e2e/mocks/handlers.ts` — PostgREST URL handlers for Supabase tables
- [ ] `e2e/fixtures/model-detail.json` — comprehensive model + joined tables fixture with real production data

*Existing infrastructure covers Playwright and MSW packages (both already installed).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI pipeline runs model-detail tests without skip | E2E-03 | CI environment | Push branch, verify GitHub Actions e2e job passes with all 3 tests executing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
