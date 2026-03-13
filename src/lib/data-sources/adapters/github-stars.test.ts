import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import adapter, { __testables } from "./github-stars";

interface MockModel {
  id: string;
  name: string;
  slug: string;
  github_url: string | null;
}

function makeSupabase(models: MockModel[], updates: Array<{ id: string; values: Record<string, unknown> }>) {
  return {
    from(table: string) {
      if (table !== "models") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select() {
          return {
            eq() {
              return {
                not() {
                  return Promise.resolve({
                    data: models,
                    error: null,
                  });
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq(_column: string, id: string) {
              updates.push({ id, values });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

describe("github-stars adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses a canonical repo override for known broken model mappings", async () => {
    const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
    const supabase = makeSupabase(
      [
        {
          id: "model-1",
          name: "Llama 4 Maverick",
          slug: "meta-llama-4-maverick",
          github_url: "https://github.com/meta-llama/llama4",
        },
      ],
      updates
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          stargazers_count: 12345,
          forks_count: 678,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const result = await adapter.sync({
      supabase: supabase as never,
      config: { delayMs: 0 },
      secrets: { GITHUB_TOKEN: "token" },
      lastSyncAt: null,
      signal: undefined,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        canonicalRepoCorrections: 1,
        staleMetricsCleared: 0,
        warningCount: 0,
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/meta-llama/llama-models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    );
    expect(updates).toEqual([
      {
        id: "model-1",
        values: expect.objectContaining({
          github_url: "https://github.com/meta-llama/llama-models",
          github_stars: 12345,
          github_forks: 678,
        }),
      },
    ]);
  });

  it("clears stale metrics when a configured repo returns 404 without failing the source", async () => {
    const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
    const supabase = makeSupabase(
      [
        {
          id: "model-2",
          name: "Broken Repo Model",
          slug: "broken-repo-model",
          github_url: "https://github.com/example/missing-repo",
        },
      ],
      updates
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await adapter.sync({
      supabase: supabase as never,
      config: { delayMs: 0 },
      secrets: {},
      lastSyncAt: null,
      signal: undefined,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        staleMetricsCleared: 1,
        warningCount: 1,
      })
    );
    expect(updates).toEqual([
      {
        id: "model-2",
        values: {
          github_stars: null,
          github_forks: null,
        },
      },
    ]);
  });

  it("exposes the canonical Llama 4 repo override", () => {
    expect(
      __testables.resolveGitHubSourceUrl({
        slug: "meta-llama-4-maverick",
        github_url: "https://github.com/meta-llama/llama4",
      })
    ).toBe("https://github.com/meta-llama/llama-models");
  });
});
