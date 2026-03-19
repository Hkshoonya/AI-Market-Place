# Recovery Tracking — 2026-03-19

This note records what was recovered after the reinstall and how it maps to the current live branch.

Reference head while writing:

- Local `main`: `8df051a5ab7c9718f9c2a8bd92972b19b678e861`

## Recovered artifacts

- [recovery/codex-history/history.jsonl](/home/doczeus/Projects/AI%20Market%20Cap/recovery/codex-history/history.jsonl)
  - 1,469 lines
  - 19 preserved session ids
  - timestamp span from `2026-01-13T05:53:24Z` through `2026-03-16T17:46:38Z`
  - latest preserved session id in this file: `019cf7c1-5166-71b1-b726-49167c3de015`
- [recovery/codex-history/overnight-session-2026-03-12-to-2026-03-15.jsonl](/home/doczeus/Projects/AI%20Market%20Cap/recovery/codex-history/overnight-session-2026-03-12-to-2026-03-15.jsonl)
  - 24,850 lines
  - timestamp span from `2026-03-12T16:58:46.514Z` through `2026-03-15T04:12:57.104Z`
  - this is the main preserved long-form implementation session for the March roadmap burst

## Recovery-to-live mapping

The recovered work is not just archival. The following commit chain on `main` reflects the resumed recovery work that was validated and pushed live after the reinstall:

- `a135108` Fix wallet pagination and cron health visibility
- `0abf497` Schedule wallet deposit scans and harden payout validation
- `8b72dd6` Make homepage Supabase client build-safe
- `2384f20` Block duplicate authenticated marketplace purchases
- `5e25aac` Complete marketplace orders only after delivery succeeds
- `5dbfb0f` Surface agent cron failures in health checks
- `490c6eb` Harden search fallback and client handling
- `ff8c01e` Improve agent admin visibility and audit status
- `91c4560` Add roadmap plan audit matrix
- `f7947cd` Restrict legacy marketplace order creation
- `b04e640` Clarify marketplace order and purchase docs
- `8b815cd` Surface failing scheduled agent runs
- `173ad74` Trigger Railway redeploy
- `0532ad8` Add admin-managed agent model overrides
- `0809303` Show provider model usage in agent tasks
- `1c53dca` Fix admin agent tasks build typing
- `8df051a` Normalize sync interval migration version

## What is now accounted for

- recovered implementation history is preserved locally under `recovery/`
- the highest-risk recovered production fixes are now on GitHub `main`
- the Supabase migration mismatch discovered after recovery has been repaired and aligned with the repo migration chain through `051`

## What still remains outside recovery proof

- Railway runtime proof still needs live verification from deployed state, not just repo state
- broad roadmap closure is still partially an operator/runtime verification problem rather than a missing-history problem
- `recovery/` remains intentionally untracked so it is preserved locally without polluting production source control
