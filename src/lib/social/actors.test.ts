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

  it("creates a fallback profile before creating a human actor when the profile row is missing", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: null,
    }));
    const existingEq = vi.fn(() => ({ maybeSingle }));
    const existingSelect = vi.fn(() => ({ eq: existingEq }));

    const missingProfileSingle = vi.fn(async () => ({
      data: null,
      error: { message: "JSON object requested, multiple (or no) rows returned" },
    }));
    const profileEq = vi.fn(() => ({ single: missingProfileSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));

    const createdProfile = {
      id: "user-1",
      username: "user",
      display_name: "User",
      avatar_url: "https://example.com/avatar.png",
      bio: null,
      reputation_score: 0,
    };
    const profileUpsertSingle = vi.fn(async () => ({
      data: createdProfile,
      error: null,
    }));
    const profileUpsertSelect = vi.fn(() => ({ single: profileUpsertSingle }));
    const profileUpsert = vi.fn(() => ({ select: profileUpsertSelect }));

    const createdActor = {
      id: "actor-1",
      actor_type: "human",
      owner_user_id: "user-1",
      profile_id: "user-1",
      display_name: "User",
      handle: "user",
      avatar_url: "https://example.com/avatar.png",
      bio: null,
      trust_tier: "trusted",
      reputation_score: 0,
      autonomy_enabled: true,
      metadata: {},
    };
    const actorInsertSingle = vi.fn(async () => ({
      data: createdActor,
      error: null,
    }));
    const actorInsertSelect = vi.fn(() => ({ single: actorInsertSingle }));
    const actorInsert = vi.fn(() => ({ select: actorInsertSelect }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "network_actors") {
          return {
            select: existingSelect,
            insert: actorInsert,
          };
        }

        if (table === "profiles") {
          return {
            select: profileSelect,
            upsert: profileUpsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown;

    const { resolveOrCreateHumanActor } = await import("./actors");

    const actor = await resolveOrCreateHumanActor(supabase as never, "user-1", {
      email: "user@example.com",
      displayName: "User",
      avatarUrl: "https://example.com/avatar.png",
    });

    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        email: "user@example.com",
        display_name: "User",
      }),
      { onConflict: "id" }
    );
    expect(actor).toEqual(expect.objectContaining({ id: "actor-1", profile_id: "user-1" }));
  });
});
