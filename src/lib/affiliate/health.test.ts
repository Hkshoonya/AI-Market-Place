import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLookup = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => mockLookup(...args),
}));

import { checkAffiliateDestination } from "./health";

describe("affiliate destination health checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("re-resolves every redirect and blocks a private destination", async () => {
    mockLookup
      .mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://redirect.example/next" },
      })
    );

    const result = await checkAffiliateDestination("https://affiliate.example/start");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/non-public address/i);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back from an unsupported HEAD request to a bounded GET", async () => {
    mockLookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const result = await checkAffiliateDestination("https://affiliate.example/start");

    expect(result).toMatchObject({ ok: true, status: "healthy", httpStatus: 200 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({
      method: "GET",
      redirect: "manual",
    });
  });
});
