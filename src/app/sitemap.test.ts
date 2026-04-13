import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/constants/site";
import sitemap from "./sitemap";

vi.mock("@/lib/supabase/public-server", () => ({
  createOptionalPublicClient: vi.fn(),
}));

import { createOptionalPublicClient } from "@/lib/supabase/public-server";

const createOptionalPublicClientMock = vi.mocked(createOptionalPublicClient);

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns static routes when the public client is unavailable", async () => {
    createOptionalPublicClientMock.mockReturnValue(null);

    const routes = await sitemap();

    expect(routes.length).toBeGreaterThan(5);
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: SITE_URL }),
        expect.objectContaining({ url: `${SITE_URL}/models` }),
        expect.objectContaining({ url: `${SITE_URL}/marketplace` }),
        expect.objectContaining({ url: `${SITE_URL}/commons/actors` }),
        expect.objectContaining({ url: `${SITE_URL}/commons/communities` }),
      ])
    );
  });

  it("falls back to static routes when dynamic queries throw", async () => {
    createOptionalPublicClientMock.mockReturnValue({
      from: () => {
        throw new Error("supabase unavailable");
      },
    } as ReturnType<typeof createOptionalPublicClient>);

    const routes = await sitemap();

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: SITE_URL }),
        expect.objectContaining({ url: `${SITE_URL}/providers` }),
      ])
    );
  });
});
