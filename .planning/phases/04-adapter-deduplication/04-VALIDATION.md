---
phase: 4
slug: adapter-deduplication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ADAPT-01 | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | ADAPT-02 | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |
| 04-02-01 | 02 | 1 | ADAPT-03 | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |
| 04-02-02 | 02 | 1 | ADAPT-04 | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:
- Vitest configured (Phase 1)
- TypeScript strict mode enabled
- `npx tsc --noEmit` already passes clean

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No inline KNOWN_MODELS blocks | ADAPT-01 | Absence check | `grep -r "KNOWN_MODELS" src/lib/data-sources/adapters/ --include="*.ts"` should show only imports |
| No per-adapter inferCategory | ADAPT-02 | Absence check | `grep -rn "function inferCategory" src/lib/data-sources/adapters/` should return 0 results |
| No per-adapter buildRecord | ADAPT-03 | Absence check | `grep -rn "function buildRecord" src/lib/data-sources/adapters/` should return 0 results |

*All verifiable via grep commands in verification step.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
