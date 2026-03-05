---
phase: 10
slug: ci-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx tsc --noEmit && npm test`
- **After every plan wave:** Run `npm run lint && npx tsc --noEmit && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | CICD-01 | smoke | `npm run lint` | N/A (workflow) | pending |
| 10-01-02 | 01 | 1 | CICD-02 | smoke | `npx tsc --noEmit` | N/A (workflow) | pending |
| 10-01-03 | 01 | 1 | CICD-03 | smoke | `npm test` | N/A (workflow) | pending |
| 10-01-04 | 01 | 1 | CICD-04 | manual | Manual: branch protection UI setup | N/A (GitHub settings) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase creates CI infrastructure, not application code or tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR merge blocked when checks fail | CICD-04 | GitHub branch protection is a UI setting, not testable in code | 1. Push workflow to main 2. Create test PR with type error 3. Verify red check appears 4. Verify merge button is blocked 5. Configure branch protection rules |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
