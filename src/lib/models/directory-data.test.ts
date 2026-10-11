import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  models: [] as Record<string, unknown>[],
  deployments: [] as Record<string, unknown>[],
  calls: [] as { table: string; operations: unknown[][]; from: number; to: number }[],
  cached: new Map<string, unknown>(),
  registrations: [] as { keys: string[]; options: { revalidate: number } }[],
  errorFrom: -1,
  rpcData: undefined as unknown,
  active: 0,
  peak: 0,
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys: string[], options: { revalidate: number }) => {
    state.registrations.push({ keys, options });
    return async (...args: unknown[]) => {
      const key = JSON.stringify([keys, args]);
      if (state.cached.has(key)) return state.cached.get(key);
      const value = await fn(...args);
      state.cached.set(key, value);
      return value;
    };
  },
}));

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => ({
    rpc: async (name: string, args: { p_offset: number }) => {
      const from = args.p_offset;
      state.calls.push({ table: "rpc", operations: [["rpc", name, args]], from, to: from + 499 });
      state.peak = Math.max(state.peak, ++state.active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      state.active -= 1;
      if (from === state.errorFrom) return { data: null, error: { message: "private database details" } };
      return {
        data: state.rpcData === undefined
          ? { data: state.models.slice(from, from + 500), count: from === 0 ? state.models.length : null }
          : state.rpcData,
        error: null,
      };
    },
    from: (table: string) => {
      const operations: unknown[][] = [];
      const chain: Record<string, unknown> = {};
      for (const name of ["select", "eq", "in", "lt", "gte", "or", "order"]) {
        chain[name] = (...args: unknown[]) => { operations.push([name, ...args]); return chain; };
      }
      chain.range = async (from: number, to: number) => {
        state.calls.push({ table, operations, from, to });
        state.peak = Math.max(state.peak, ++state.active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        state.active -= 1;
        if (from === state.errorFrom) return { data: null, error: { message: "private database details" }, count: null };
        const rows = table === "models" ? state.models : state.deployments;
        return { data: rows.slice(from, to + 1), error: null, count: rows.length };
      };
      return chain;
    },
  }),
}));

import {
  DirectoryCandidateSchema,
  DIRECTORY_CANDIDATE_COLUMNS,
  directoryFilterKey,
  getDirectoryCandidates,
  getDirectoryDeployments,
} from "./directory-data";

function candidate(id: number) {
  const fields = Object.fromEntries(Object.keys(DirectoryCandidateSchema.shape)
    .filter((key) => key !== "model_pricing").map((key) => [key, null]));
  return {
    ...fields, id: `model-${id}`, slug: `model-${id}`, name: `Model ${id}`,
    provider: "Example", category: "llm", status: "active", hf_downloads: 0,
    hf_likes: 0, is_api_available: true,
  };
}

beforeEach(() => {
  state.models = Array.from({ length: 1201 }, (_, id) => candidate(id));
  state.deployments = [];
  state.calls = [];
  state.cached.clear();
  state.errorFrom = -1;
  state.rpcData = undefined;
  state.active = 0;
  state.peak = 0;
});

describe("directory data", () => {
  it("keeps every row past the response limit and bounds query concurrency", async () => {
    const result = await getDirectoryCandidates(directoryFilterKey({}));
    expect(result.data).toHaveLength(1201);
    expect(result.count).toBe(1201);
    expect(state.calls.map(({ from, to }) => [from, to])).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(state.peak).toBeLessThanOrEqual(2);
    for (const call of state.calls) {
      expect(call.operations).toEqual([["rpc", "get_ranked_model_directory_page", { p_offset: call.from }]]);
    }
  });

  it("shares cached candidate pages across presentation-only URL changes", async () => {
    await getDirectoryCandidates(directoryFilterKey({ page: "1", view: "list" }));
    await getDirectoryCandidates(directoryFilterKey({ page: "2", view: "grid", deployable: "true" }));
    expect(state.calls).toHaveLength(3);
    expect(state.registrations).toContainEqual({ keys: ["public-model-directory-candidates-v2"], options: { revalidate: 300 } });
  });

  it("includes all database filters in the cache identity", () => {
    const original = directoryFilterKey({});
    for (const [key, value] of Object.entries({ category: "image", sort: "price", q: "model", open: "true", provider: "Example", params: "200+", api: "true", license: "apache_2_0", lifecycle: "all" })) {
      expect(directoryFilterKey({ [key]: value })).not.toBe(original);
    }
    expect(directoryFilterKey({ sort: "random", params: "random" })).toBe(original);
  });

  it.each(Object.entries({ category: "llm", sort: "price", q: "model", open: "true", provider: "Example", params: "200+", api: "true", license: "commercial", lifecycle: "all" }))(
    "keeps the existing filtered query for %s=%s", async (key, value) => {
      await getDirectoryCandidates(directoryFilterKey({ [key]: value }));
      expect(state.calls.every((call) => call.table === "models")).toBe(true);
      expect(state.calls[0].operations).toContainEqual(["order", "id", { ascending: true }]);
    }
  );

  it.each([null, {}, { data: [], count: null }, { data: [], count: -1 }, { data: null, count: 0 }, { data: [], count: "100" }])(
    "rejects malformed ranked pages instead of caching an incomplete directory: %j", async (data) => {
      state.rpcData = data;
      await expect(getDirectoryCandidates(directoryFilterKey({}))).rejects.toThrow("Unable to load the complete models directory");
      expect(state.cached.size).toBe(0);
    }
  );

  it("does not persist arbitrary search/provider/invalid enum queries", async () => {
    await getDirectoryCandidates(directoryFilterKey({ q: "model" }));
    await getDirectoryCandidates(directoryFilterKey({ provider: "Example" }));
    await getDirectoryCandidates(directoryFilterKey({ category: "arbitrary" }));
    await getDirectoryCandidates(directoryFilterKey({ license: "arbitrary" }));
    expect(state.cached.size).toBe(0);
  });

  it("preserves price and lifecycle query behavior with a narrow projection", async () => {
    await getDirectoryCandidates(directoryFilterKey({ sort: "price", lifecycle: "all", q: "model,(x)", api: "true", params: "10-70" }));
    const operations = state.calls[0].operations;
    expect(operations).toContainEqual(["in", "status", ["active", "beta", "preview", "deprecated", "archived"]]);
    expect(operations).toContainEqual(["eq", "is_api_available", true]);
    expect(operations).toContainEqual(["gte", "parameter_count", 10_000_000_000]);
    expect(operations).toContainEqual(["lt", "parameter_count", 70_000_000_000]);
    const select = operations.find((operation) => operation[0] === "select")?.[1];
    expect(select).toContain("model_pricing(provider_name,input_price_per_million,output_price_per_million,source,currency)");
    expect(select).not.toContain("*");
    expect(DIRECTORY_CANDIDATE_COLUMNS).toContain("description");
    expect(DIRECTORY_CANDIDATE_COLUMNS).not.toContain("fts");
  });

  it("does not cache failed pages or publish a partial catalogue", async () => {
    state.errorFrom = 500;
    await expect(getDirectoryCandidates(directoryFilterKey({}))).rejects.toThrow("Unable to load the complete models directory");
    state.errorFrom = -1;
    expect((await getDirectoryCandidates(directoryFilterKey({}))).data).toHaveLength(1201);
  });

  it("retains the existing 10000-candidate limit and the full tracked count", async () => {
    state.models = Array.from({ length: 10005 }, (_, id) => candidate(id));
    const result = await getDirectoryCandidates(directoryFilterKey({}));
    expect(result.data).toHaveLength(10000);
    expect(result.count).toBe(10005);
  });

  it("loads every deployment without a giant IN URL or a 1000-row truncation", async () => {
    state.deployments = Array.from({ length: 5182 }, (_, id) => ({ id: `dep-${id}`, model_id: `model-${id}`, status: "available" }));
    expect(await getDirectoryDeployments()).toHaveLength(5182);
    expect(state.calls).toHaveLength(6);
    for (const call of state.calls) {
      expect(call.operations.some((operation) => operation[0] === "in")).toBe(false);
      expect(call.operations).toContainEqual(["eq", "status", "available"]);
    }
    await getDirectoryDeployments();
    expect(state.calls).toHaveLength(6);
  });
});
