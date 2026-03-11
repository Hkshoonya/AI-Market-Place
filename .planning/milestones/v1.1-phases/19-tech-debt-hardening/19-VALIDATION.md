---
phase: 19
slug: tech-debt-hardening
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npx tsc --noEmit` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm test && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** `npm run lint && npm test && npx tsc --noEmit` all green
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | E2E-03, E2E-06 | smoke | `node -e "const p=require('./package.json');process.exit(p.devDependencies.msw?0:1)"` | ✅ | ✅ green |
| 19-01-02 | 01 | 1 | CICD-01 | smoke | `npm run lint` | ✅ | ✅ green |
| 19-01-03 | 01 | 1 | SIMP-01, SIMP-02 | unit | `npx tsc --noEmit` | ✅ | ✅ green |
| 19-01-04 | 01 | 1 | SIMP-02 | smoke | `grep -c useEffect src/components/marketplace/listing-reviews.tsx` (expect 0) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 25s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-03-11)

---

## Validation Audit 2026-03-11

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 4 tasks verified green. No new test files needed — phase uses existing infrastructure commands (node -e, npm run lint, npx tsc, grep) as verification.
