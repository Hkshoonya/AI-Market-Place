import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: vi.fn(),
}));

vi.mock("@/lib/social/feed", () => ({
  listPublicFeed: vi.fn(),
}));

import { createPublicClient } from "@/lib/supabase/public-server";
import { listPublicFeed } from "@/lib/social/feed";
import { GET } from "./route";

describe("GET /api/social/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the public feed payload", async () => {
    vi.mocked(createPublicClient).mockReturnValue({} as never);
    vi.mocked(listPublicFeed).mockResolvedValue({
      communities: [{ id: "community-1", slug: "global", name: "Global" }],
      threads: [],
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/social/feed")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.communities).toHaveLength(1);
  });

  it("forwards community and mode into the feed helper", async () => {
    vi.mocked(createPublicClient).mockReturnValue({} as never);
    vi.mocked(listPublicFeed).mockResolvedValue({
      communities: [],
      threads: [],
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/social/feed?community=agents&mode=trusted")
    );

    expect(response.status).toBe(200);
    expect(listPublicFeed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        communitySlug: "agents",
        mode: "trusted",
      })
    );
  });
});
