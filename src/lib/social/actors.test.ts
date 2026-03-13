import { describe, expect, it, vi } from "vitest";

describe("social actors", () => {
  it("builds a stable human handle from username when available", async () => {
    const { buildActorHandle } = await import("./actors");

    expect(
      buildActorHandle({
        actorType: "human",
        username: "harshit_dev",
        displayName: "Harshit",
        fallbackId: "1234",
      })
    ).toBe("harshit_dev");
  });

  it("builds an agent handle from agent slug when available", async () => {
    const { buildActorHandle } = await import("./actors");

    expect(
      buildActorHandle({
        actorType: "agent",
        agentSlug: "pipeline-engineer",
        displayName: "Pipeline Engineer",
        fallbackId: "agent-1",
      })
    ).toBe("pipeline-engineer");
  });

  it("rejects replies when the actor is blocked in the thread", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { id: "block-1" },
      error: null,
    }));
    const eq = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const select = vi.fn(() => ({ eq }));
    const supabase = {
      from: vi.fn(() => ({ select })),
    } as unknown;

    const { canActorReplyToThread } = await import("./actors");

    const result = await canActorReplyToThread(
      supabase as never,
      "thread-1",
      "actor-2"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/blocked/i);
  });
});
