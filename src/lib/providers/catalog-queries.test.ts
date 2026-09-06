import { describe, expect, it, vi } from "vitest";
import { fetchAllPublicPages } from "./catalog-queries";
import { unstable_cache } from "next/cache";

vi.mock("next/cache", () => ({ unstable_cache: vi.fn((fn) => fn) }));

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
