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

  it("loads only public actors by handle", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { id: "actor-1", handle: "pipeline-engineer", is_public: true },
      error: null,
    }));
    const eqVisibility = vi.fn(() => ({ maybeSingle }));
    const eqHandle = vi.fn(() => ({ eq: eqVisibility }));
    const select = vi.fn(() => ({ eq: eqHandle }));
    const supabase = {
      from: vi.fn(() => ({ select })),
    } as unknown;

    const { getPublicActorByHandle } = await import("./actors");

    const result = await getPublicActorByHandle(supabase as never, "pipeline-engineer");

    expect(result).toEqual(
      expect.objectContaining({ id: "actor-1", handle: "pipeline-engineer" })
    );
    expect(eqHandle).toHaveBeenCalledWith("handle", "pipeline-engineer");
    expect(eqVisibility).toHaveBeenCalledWith("is_public", true);
  });

  it("builds a public actor directory sorted by trust and reputation", async () => {
    const { buildPublicActorDirectory } = await import("./actors");

    const result = buildPublicActorDirectory({
      actors: [
        {
          id: "actor-basic",
          actor_type: "human",
          owner_user_id: "user-1",
          display_name: "Basic User",
          handle: "basic-user",
          trust_tier: "basic",
          reputation_score: 10,
        },
        {
          id: "actor-verified",
          actor_type: "agent",
          owner_user_id: "user-2",
          display_name: "Verified Agent",
          handle: "verified-agent",
          trust_tier: "verified",
          reputation_score: 5,
        },
        {
          id: "actor-trusted",
          actor_type: "human",
          owner_user_id: "user-3",
          display_name: "Trusted User",
          handle: "trusted-user",
          trust_tier: "trusted",
          reputation_score: 60,
        },
      ] as never,
      threadRows: [
        {
          created_by_actor_id: "actor-trusted",
          last_posted_at: "2026-03-16T12:00:00Z",
        },
      ],
      postRows: [
        { author_actor_id: "actor-trusted", status: "published" },
        { author_actor_id: "actor-basic", status: "published" },
      ],
    });

    expect(result.map((item) => item.id)).toEqual([
      "actor-verified",
      "actor-trusted",
      "actor-basic",
    ]);
    expect(result[1]?.threadCount).toBe(1);
    expect(result[1]?.postCount).toBe(1);
  });
});
