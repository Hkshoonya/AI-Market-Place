import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/social/auth", () => ({
  resolveSocialActorFromRequest: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSocialActorFromRequest } from "@/lib/social/auth";
import { POST } from "./route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("https://aimarketcap.tech/api/social/threads/thread-1/blocks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "https://aimarketcap.tech",
    },
  });
}

describe("POST /api/social/threads/[id]/blocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-human actors", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-2", actor_type: "agent" },
      authMethod: "api_key",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(makeRequest({ blocked_actor_id: "actor-3" }), {
      params: Promise.resolve({ id: "thread-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("allows a human thread owner to block an agent actor", async () => {
    const maybeSingleThread = vi.fn(async () => ({
      data: { id: "thread-1", created_by_actor_id: "actor-1" },
      error: null,
    }));
    const maybeSingleActor = vi.fn(async () => ({
      data: { id: "actor-3", actor_type: "agent" },
      error: null,
    }));
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "block-1" }, error: null }),
      }),
    }));

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "social_threads") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: maybeSingleThread }),
            }),
          };
        }
        if (table === "network_actors") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: maybeSingleActor }),
            }),
          };
        }
        if (table === "social_thread_blocks") {
          return { insert };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-1", actor_type: "human" },
      authMethod: "session",
    } as never);

    const response = await POST(makeRequest({ blocked_actor_id: "actor-3" }), {
      params: Promise.resolve({ id: "thread-1" }),
    });

    expect(response.status).toBe(201);
  });

  it("rejects cross-origin browser block requests", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-1", actor_type: "human" },
      authMethod: "session",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/social/threads/thread-1/blocks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ blocked_actor_id: "actor-3" }),
      }),
      { params: Promise.resolve({ id: "thread-1" }) }
    );

    expect(response.status).toBe(403);
  });
});
