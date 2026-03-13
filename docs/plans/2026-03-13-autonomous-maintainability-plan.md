# Plan

Build an autonomous maintainability control loop on top of the existing resident agents so the system can detect issues, classify them, run bounded remediations, verify outcomes, and escalate safely when confidence is low. The high-level approach is to preserve the working runtime that now exists, remove single-provider assumptions from the agent layer, and then formalize issue detection, playbooks, and verification into a durable agent substrate.

## Scope
- In:
  - Resident-agent reliability and provider resilience
  - Machine-readable issue tracking for autonomous maintenance
  - Safe runtime/data remediation playbooks
  - Verification gates, escalation rules, and observability
  - Maintainability refactors for fragile data/agent code paths
- Out:
  - Autonomous destructive schema rewrites
  - Unreviewed marketplace funds actions
  - Automatic production code pushes without an explicit later decision

## Action items
[ ] Normalize the agent substrate by keeping `pipeline-engineer`, `code-quality`, and `ux-monitor` as the first-class resident agents, and add a provider router beneath `src/lib/agents/chat.ts` and any future LLM-backed agent logic so agent execution is not coupled to Anthropic alone.
[ ] Introduce a small provider abstraction in `src/lib/agents/` that prefers `OPENROUTER_API_KEY` when present, supports direct `DEEPSEEK_API_KEY` and `MINIMAX_API_KEY` fallbacks when configured, and records which provider/model handled each agent task for auditability.
[ ] Add an issue ledger in Supabase for autonomous maintenance work items with fields for subsystem, severity, confidence, evidence, selected playbook, retry count, verification result, and escalation status instead of forcing agents to infer state from logs alone.
[ ] Refactor resident-agent outputs into explicit detector and verifier roles: `pipeline-engineer` for source/runtime issues, `code-quality` for repeated operational/code error patterns, and `ux-monitor` for completeness and presentation regressions, with each agent writing structured findings instead of only narrative logs.
[ ] Encode idempotent remediation playbooks for the safe classes already present in the codebase: source resync, source quarantine, stale cron cleanup, recompute triggers, health rechecks, and data cleanup of incorrect derived rows, while forbidding schema, auth, and wallet actions from autonomous execution.
[ ] Add post-remediation verification gates so every automated action reruns the relevant health, sync, or agent check before closing the issue; if verification fails twice, mark the issue escalated and stop retrying.
[ ] Tighten maintainability-oriented observability by surfacing recent agent runs, issue states, playbook outcomes, provider usage, and escalation reasons in the admin area next to current data-source and integrity health.
[ ] Continue code-quality simplification in the high-churn areas by extracting shared pagination/query helpers, shared agent playbook helpers, and shared provider-calling utilities so future changes stop reintroducing one-off logic like the `ux-monitor` truncation bug.
[ ] Add focused regression coverage for the autonomous loop itself: agent provider routing, issue-ledger writes, playbook retry/verification behavior, and resident-agent metrics calculations.
[ ] Roll this out in four operating modes: observe-only, recommend-only, auto-remediate safe playbooks, then scheduled self-healing with escalation dashboards, validating each phase with `npm test`, `npm run build`, and live cron/health verification.

## Open questions
- Should automatic code changes stop at issue creation plus patch proposal, or do you want a later phase where agents can open PRs automatically?
- Do you want OpenRouter to be the canonical provider router for all maintenance agents, or only the default with direct DeepSeek and MiniMax bypass paths for selected playbooks?
- Should the issue ledger live purely in Supabase tables, or do you want a mirrored operational view in GitHub issues for human review?
