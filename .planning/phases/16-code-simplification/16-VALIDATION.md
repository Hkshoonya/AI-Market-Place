---
phase: 16
slug: code-simplification
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Playwright |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx tsc --noEmit && npx vitest run --reporter=dot` |
| **Full suite command** | `npx tsc --noEmit && npx vitest run && npx eslint .` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx tsc --noEmit && npx vitest run && npx eslint .`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | SIMP-02 | lint+typecheck | `npx tsc --noEmit && npx vitest run` | Yes | pending |
| 16-01-02 | 01 | 1 | SIMP-02 | lint | `npx eslint src/components/search-dialog.tsx src/app/(marketplace)/marketplace/auctions/[id]/auction-detail-content.tsx` | Yes | pending |
| 16-02-01 | 02 | 2 | SIMP-01 | unit+typecheck | `npx tsc --noEmit && npx vitest run` | Yes | pending |
| 16-02-02 | 02 | 2 | SIMP-01, SIMP-02 | lint (zero warnings) | `npx eslint . --max-warnings 0` | Yes | pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three.js scenes still render | SIMP-01 | No visual regression tests for 3D scenes | Load page with ambient-scene, verify no console errors and scene renders |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-11
