# Agent Autonomy Design

## Goal

Make the resident-agent system provider-resilient and operationally autonomous enough to detect, log, triage, and safely remediate platform issues without being coupled to a single LLM vendor or to unstructured logs.

## Current State

- Resident agents exist and run successfully:
  - `pipeline-engineer`
  - `code-quality`
  - `ux-monitor`
- The health and pipeline runtime are healthy in production.
- The main architectural weakness is that LLM-backed agent logic is still effectively Anthropic-only.
- Deferred work currently lives in docs and operator memory, not in a machine-readable system the agents can use.

## Requirements

### Functional

1. Route agent LLM tasks through a provider-agnostic abstraction.
2. Prefer OpenRouter as the default router when available.
3. Support direct DeepSeek and MiniMax fallbacks when configured.
4. Record provider/model metadata for every LLM-backed task.
5. Add a structured issue ledger for autonomous maintenance work.
6. Add a structured deferred ledger so postponed work is visible and reviewable before later shipping.
7. Keep self-healing bounded to safe playbooks only.

### Non-Functional

1. No destructive autonomous schema or funds actions.
2. Verification required after any automated remediation.
3. Degrade safely when no provider is configured.
4. Keep the first implementation slice small enough to ship safely.

## Recommended Architecture

### 1. Agent Provider Router

Add a lightweight provider router under `src/lib/agents/`:

- Normalize requests to a single internal shape:
  - system prompt
  - user prompt
  - messages
  - temperature
  - max tokens
  - response format hint
- Choose provider in this order:
  1. OpenRouter
  2. DeepSeek
  3. MiniMax
  4. Anthropic
- Return a normalized response shape:
  - content
  - provider
  - model
  - usage
  - raw metadata

This keeps the agent layer independent from any one SDK or vendor.

### 2. Autonomous Issue Ledger

Add a dedicated table for operational issues raised by agents.

Each issue should contain:
- `slug`
- `issue_type`
- `source`
- `severity`
- `status`
- `confidence`
- `detected_by`
- `playbook`
- `evidence`
- `verification`
- `retry_count`
- `escalated_at`
- `resolved_at`

This becomes the canonical record for machine-generated maintenance work.

### 3. Deferred Work Ledger

Add a separate table for intentionally postponed work.

Each deferred item should contain:
- `slug`
- `title`
- `area`
- `reason`
- `risk_level`
- `required_before`
- `owner_hint`
- `notes`
- `status`

This prevents roadmap or pre-ship items from being forgotten while feature work continues.

### 4. Safe Playbook Boundary

Only allow autonomous execution for playbooks that are already operationally safe:

- source resync
- source quarantine
- health recheck
- score recompute
- stale cron cleanup

Disallow autonomous execution for:

- marketplace payouts
- schema rewrites
- auth model changes
- fee-policy changes
- seller moderation decisions

## Integration Plan

### First Slice

Ship:
- provider router
- issue ledger schema
- deferred ledger schema
- logging helpers
- `code-quality` and `generateAgentResponse` migrated to provider router
- `pipeline-engineer`, `code-quality`, and `ux-monitor` writing structured issue records

Do not ship yet:
- automatic code generation
- automatic PR creation
- marketplace-fee policy
- agent-to-agent commerce workflows

### Second Slice

Ship:
- verifier helpers
- admin visibility for issues and deferred items
- retry and escalation policy

### Marketplace Boundary

When work moves toward the marketplace becoming fully agent-native for buying and selling code, skills, agents, and MCP servers, pause and brainstorm again before implementation. That phase changes trust, policy, economics, and settlement behavior, and should not be folded into maintenance infrastructure by inertia.

## Risks

1. Provider divergence in API behavior
2. LLM output instability for structured triage
3. Autonomous loops masking rather than fixing root causes
4. Deferred work becoming a graveyard if not surfaced in admin

## Mitigations

1. Normalize provider responses into one internal shape.
2. Require structured JSON output for issue creation paths.
3. Add verification and escalation after remediation.
4. Surface deferred items and issue states in admin and logs.
