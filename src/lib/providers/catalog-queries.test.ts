import { describe, expect, it, vi } from "vitest";
import { fetchAllPublicPages, getActiveProviderNames } from "./catalog-queries";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-server";

vi.mock("next/cache", () => ({ unstable_cache: vi.fn((fn) => fn) }));
vi.mock("@/lib/supabase/public-server", () => ({ createPublicClient: vi.fn() }));

describe("getActiveProviderNames", () => {
  it("fetches all names in one anonymous RPC and caches only public data", async () => {
    const names = Array.from({ length: 1501 }, (_, i) => `Provider ${i}`);
    const rpc = vi.fn().mockResolvedValue({ data: names, error: null });
    vi.mocked(createPublicClient).mockReturnValue({ rpc } as never);
    await expect(getActiveProviderNames()).resolves.toEqual(names);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_active_provider_names");
    expect(unstable_cache).toHaveBeenCalledWith(
      expect.any(Function), ["public-active-provider-names-v2"], { revalidate: 300 }
    );
  });

  it.each([
    { data: null, error: { message: "private database detail" } },
    { data: null, error: null },
    { data: [{ provider: "wrong shape" }], error: null },
    { data: [null], error: null },
  ])("rejects incomplete or malformed summaries: %j", async (result) => {
    vi.mocked(createPublicClient).mockReturnValue({ rpc: vi.fn().mockResolvedValue(result) } as never);
    await expect(getActiveProviderNames()).rejects.toThrow("Unable to load the complete public provider catalog");
  });

  it("supports an empty provider summary", async () => {
    vi.mocked(createPublicClient).mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) } as never);
    await expect(getActiveProviderNames()).resolves.toEqual([]);
  });
});

describe("fetchAllPublicPages", () => {
  it("uses explicit cache namespaces and a five-minute public-data lifetime", async () => {
    await fetchAllPublicPages(async () => ({ data: [], error: null }), "directory-models");
    expect(unstable_cache).toHaveBeenCalledWith(
      expect.any(Function), ["public-provider-catalog-v1", "directory-models"], { revalidate: 300 }
    );
  });

  it("reads past the Supabase response cap without losing rows", async () => {
    const rows = Array.from({ length: 2105 }, (_, id) => ({ id }));
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1), error: null,
    }));
    await expect(fetchAllPublicPages(fetchPage)).resolves.toEqual({ data: rows, error: null });
    expect(fetchPage.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("checks an empty final page for an exact multiple of the page size", async () => {
    const fetchPage = vi.fn(async (from: number) => ({
      data: from === 0 ? Array.from({ length: 1000 }, (_, id) => id) : [], error: null,
    }));
    expect((await fetchAllPublicPages(fetchPage)).data).toHaveLength(1000);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("fails instead of publishing partial data or a false provider 404", async () => {
    const fetchPage = vi.fn(async (from: number) => from === 0
      ? { data: Array.from({ length: 1000 }, (_, id) => id), error: null }
      : { data: null, error: { message: "private database details" } });
    await expect(fetchAllPublicPages(fetchPage)).rejects.toThrow(
      "Unable to load the complete public provider catalog"
    );
  });

  it("supports an empty catalog", async () => {
    await expect(fetchAllPublicPages(async () => ({ data: [], error: null })))
      .resolves.toEqual({ data: [], error: null });
  });
});
