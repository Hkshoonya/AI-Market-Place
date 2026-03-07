---
phase: 11
slug: zod-runtime-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `vitest/config`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/schemas/ -x` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/schemas/ -x`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | TYPE-01 | unit | `npx vitest run src/lib/schemas/models.test.ts -x` | No -- W0 | pending |
| 11-01-02 | 01 | 1 | TYPE-02 | unit | `npx vitest run src/lib/schemas/parse.test.ts -x` | No -- W0 | pending |
| 11-01-03 | 01 | 1 | TYPE-03 | unit | `npx vitest run src/lib/schemas/parse.test.ts -x` | No -- W0 | pending |
| 11-02-01 | 02 | 2 | TYPE-01 | integration | `npx vitest run src/lib/schemas/ -x` | No -- W0 | pending |
| 11-03-01 | 03 | 2 | TYPE-01 | integration | `npx vitest run && npx tsc --noEmit` | Existing | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/schemas/parse.test.ts` — unit tests for parseQueryResult and parseQueryResultSingle (TYPE-02, TYPE-03)
- [ ] `src/lib/schemas/models.test.ts` — validates base model schema and query-specific picks against sample data (TYPE-01)
- [ ] Sentry mock setup: `vi.mock("@sentry/nextjs")` in test files for TYPE-03 assertions

*Wave 0 creates test stubs before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry dashboard shows `error.type: schema_validation` tag | TYPE-03 | Requires live Sentry instance | Deploy to staging, trigger a schema mismatch, verify Sentry event has correct tags and fingerprint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
