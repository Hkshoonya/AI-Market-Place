# Agent Autonomy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add provider-agnostic agent LLM routing plus machine-readable issue and deferred ledgers for autonomous maintenance.

**Architecture:** Introduce a normalized provider router in `src/lib/agents`, persist autonomous issues and deferred items in Supabase, then wire the existing resident agents to emit structured records instead of relying only on narrative logs. Keep the first slice strictly inside safe maintenance boundaries and out of marketplace economics and settlement logic.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase, Railway, external cron.

---

### Task 1: Add the Failing Tests for Agent Routing

**Files:**
- Create: `src/lib/agents/provider-router.test.ts`

**Step 1: Write failing tests**

Cover:
- provider selection order prefers OpenRouter when configured
- falls back to DeepSeek when OpenRouter is unavailable
- falls back to MiniMax when OpenRouter and DeepSeek are unavailable
- returns a consistent normalized response shape

**Step 2: Run the tests and verify failure**

Run:
```bash
npm test -- src/lib/agents/provider-router.test.ts
```

Expected: FAIL because the router does not exist yet.

---

### Task 2: Implement the Provider Router

**Files:**
- Create: `src/lib/agents/provider-router.ts`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/agents/types.ts`

**Step 1: Add env support**

Add optional env handling for:
- `DEEPSEEK_API_KEY`
- `MINIMAX_API_KEY`

**Step 2: Add normalized router types**

Define request and response types for:
- prompt/messages
- response text
- provider
- model
- usage

**Step 3: Implement the router**

Use HTTP `fetch` against provider-compatible chat completion endpoints and normalize the output.

**Step 4: Re-run the router tests**

Run:
```bash
npm test -- src/lib/agents/provider-router.test.ts
```

Expected: PASS.

---

### Task 3: Add the Failing Tests for Ledgers

**Files:**
- Create: `src/lib/agents/ledger.test.ts`

**Step 1: Write failing tests**

Cover:
- issue upsert payload shape
- deferred item upsert payload shape
- deduping by slug
- provider metadata captured in evidence

**Step 2: Run the tests and verify failure**

Run:
```bash
npm test -- src/lib/agents/ledger.test.ts
```

Expected: FAIL because the ledger helpers do not exist yet.

---

### Task 4: Implement Issue and Deferred Ledgers

**Files:**
- Create: `src/lib/agents/ledger.ts`
- Create: `supabase/migrations/032_agent_autonomy_ledgers.sql`
- Modify: `src/types/database.ts`

**Step 1: Add forward-only schema**

Create:
- `agent_issues`
- `agent_deferred_items`

with service-role and admin-safe access policies.

**Step 2: Add helper functions**

Implement:
- `recordAgentIssue(...)`
- `resolveAgentIssue(...)`
- `recordDeferredItem(...)`

**Step 3: Re-run the ledger tests**

Run:
```bash
npm test -- src/lib/agents/ledger.test.ts
```

Expected: PASS.

---

### Task 5: Migrate LLM-Backed Agent Paths

**Files:**
- Modify: `src/lib/agents/chat.ts`
- Modify: `src/lib/agents/residents/code-quality.ts`

**Step 1: Write failing regression tests**

Add tests showing:
- `generateAgentResponse` uses the provider router instead of Anthropic directly
- `code-quality` can analyze patterns through the provider router
- provider/model metadata is emitted in task outputs or message metadata

**Step 2: Run them and verify failure**

Run the focused tests.

**Step 3: Implement the migration**

Replace direct Anthropic SDK usage with the provider router.

**Step 4: Re-run the focused tests**

Expected: PASS.

---

### Task 6: Wire Structured Issues from Resident Agents

**Files:**
- Modify: `src/lib/agents/residents/pipeline-engineer.ts`
- Modify: `src/lib/agents/residents/code-quality.ts`
- Modify: `src/lib/agents/residents/ux-monitor.ts`

**Step 1: Write failing tests**

Cover that each resident agent records structured issues for its own domain:
- failed source / unhealthy source
- repeated error pattern
- completeness or marketplace-health degradation

**Step 2: Run tests and verify failure**

**Step 3: Implement the minimal issue-recording logic**

Keep it bounded to detection only in this slice. Do not implement automatic playbook mutation yet beyond what already exists.

**Step 4: Re-run the focused tests**

Expected: PASS.

---

### Task 7: Seed Deferred Work So It Is Not Forgotten

**Files:**
- Create: `src/lib/agents/deferred-seed.ts`
- Modify: `src/app/api/admin/agents/route.ts`

**Step 1: Add deferred seed constants**

Seed high-signal deferred items such as:
- provider routing expansion
- verifier agent
- admin issue dashboard
- auto-PR or patch proposal policy
- pre-ship marketplace trust and fee policy
- agent-native commerce design revisit

**Step 2: Expose deferred items in admin API**

Return recent issues and deferred items alongside agents.

**Step 3: Add focused tests**

Verify admin response includes the new ledger summaries.

---

### Task 8: Final Verification

**Files:**
- Verify touched files above

**Step 1: Run focused tests**

Run the new agent routing and ledger tests.

**Step 2: Run full verification**

Run:
```bash
npm test
npm run build
```

**Step 3: Run live-safe verification**

Check:
- `/api/health`
- `/api/pipeline/health`
- one resident-agent trigger

**Step 4: Commit**

Commit only the agent autonomy slice.
