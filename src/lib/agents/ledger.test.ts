import { describe, expect, it, vi } from "vitest";

describe("agent ledger helpers", () => {
  it("upserts agent issues by slug with structured payload", async () => {
    const upsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: "issue-1" }, error: null }) }) }));
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    } as unknown;

    const { recordAgentIssue } = await import("./ledger");

    await recordAgentIssue(supabase as never, {
      slug: "pipeline-openrouter-models-health",
      title: "OpenRouter models source unhealthy",
      issueType: "source_health",
      source: "openrouter-models",
      severity: "high",
      confidence: 0.92,
      detectedBy: "pipeline-engineer",
      playbook: "resync_source",
      evidence: { provider: "openrouter", failures: 3 },
    });

    expect(supabase.from).toHaveBeenCalledWith("agent_issues");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "pipeline-openrouter-models-health",
        issue_type: "source_health",
        detected_by: "pipeline-engineer",
        playbook: "resync_source",
      }),
      expect.objectContaining({ onConflict: "slug" })
    );
  });

  it("upserts deferred items by slug", async () => {
    const upsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: "deferred-1" }, error: null }) }) }));
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    } as unknown;

    const { recordDeferredItem } = await import("./ledger");

    await recordDeferredItem(supabase as never, {
      slug: "marketplace-fee-policy",
      title: "Decide marketplace fee introduction policy",
      area: "marketplace",
      reason: "Defer economics until trust and autonomous commerce stabilize",
      riskLevel: "medium",
      requiredBefore: "marketplace-fee-rollout",
      ownerHint: "product",
      notes: { revisitWhen: "agent-native commerce planning" },
    });

    expect(supabase.from).toHaveBeenCalledWith("agent_deferred_items");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "marketplace-fee-policy",
        area: "marketplace",
        risk_level: "medium",
      }),
      expect.objectContaining({ onConflict: "slug" })
    );
  });

  it("marks issues investigating and increments retry count after failed verification", async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const maybeSingle = vi.fn(async () => ({ data: { retry_count: 1 }, error: null }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const supabase = {
      from: vi.fn(() => ({ select, update })),
    } as unknown;

    const { recordAgentIssueFailure } = await import("./ledger");

    await recordAgentIssueFailure(
      supabase as never,
      "pipeline-source-open-vlm-leaderboard",
      { verifier: "pipeline-engineer", reason: "repair sync failed" },
      3
    );

    expect(supabase.from).toHaveBeenCalledWith("agent_issues");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "investigating",
        retry_count: 2,
      })
    );
    expect(updateEq).toHaveBeenCalledWith("slug", "pipeline-source-open-vlm-leaderboard");
  });

  it("escalates issues when failed verification reaches the retry threshold", async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const maybeSingle = vi.fn(async () => ({ data: { retry_count: 2 }, error: null }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const supabase = {
      from: vi.fn(() => ({ select, update })),
    } as unknown;

    const { recordAgentIssueFailure } = await import("./ledger");

    await recordAgentIssueFailure(
      supabase as never,
      "pipeline-source-seal-leaderboard",
      { verifier: "pipeline-engineer", reason: "repair sync failed again" },
      3
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "escalated",
        retry_count: 3,
      })
    );
  });
});
