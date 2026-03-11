---
phase: 17
slug: ci-verification-branch-protection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx tsc --noEmit && npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | CICD-01 | smoke | `npm run lint` | N/A (workflow) | ⬜ pending |
| 17-01-02 | 01 | 1 | CICD-02 | smoke | `npx tsc --noEmit` | N/A (workflow) | ⬜ pending |
| 17-01-03 | 01 | 1 | CICD-03 | smoke | `npm test` | N/A (workflow) | ⬜ pending |
| 17-01-04 | 01 | 1 | CICD-04 | manual-only | Manual: GitHub branch protection | N/A (GitHub UI) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test infrastructure needed — this phase creates documentation artifacts (VERIFICATION.md) and configures GitHub settings.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR merges blocked on CI failure | CICD-04 | Requires GitHub UI/API configuration and live PR testing | Configure branch protection, open PR with type error, verify merge blocked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
