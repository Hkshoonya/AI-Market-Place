---
phase: 12
slug: component-testing-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` (exists, needs modification for projects) |
| **Quick run command** | `npx vitest run --project component` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run` + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | TEST-01 | smoke | `npx vitest run` (verify exit 0, both projects execute) | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | TEST-02 | smoke | `npx vitest run --project component` (verify no peer dep warnings) | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | TEST-03 | component | `npx vitest run src/components/search-dialog.test.tsx` | ❌ | ⬜ pending |
| 12-02-02 | 02 | 2 | TEST-03 | component | `npx vitest run src/components/marketplace/filter-bar.test.tsx` | ❌ | ⬜ pending |
| 12-02-03 | 02 | 2 | TEST-03 | component | `npx vitest run src/components/models/ranking-weight-controls.test.tsx` | ❌ | ⬜ pending |
| 12-02-04 | 02 | 2 | TEST-03 | component | `npx vitest run src/components/layout/market-ticker.test.tsx` | ❌ | ⬜ pending |
| 12-02-05 | 02 | 2 | TEST-03 | component | `npx vitest run src/components/models/comments-section.test.tsx` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install dev deps: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@testing-library/dom`, `@vitejs/plugin-react`, `jsdom`
- [ ] `src/test/setup-component.ts` — jest-dom matchers, cleanup, Next.js module mocks
- [ ] `vitest.config.ts` — rewrite to use `projects` configuration (two inline projects)
- [ ] Verify existing 170+ node tests still pass after config change

*Wave 0 is part of Plan 01.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| styled-jsx warning suppression | TEST-02 | Cosmetic console warning only | Run component test, check console output for styled-jsx warnings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
