import { describe, expect, it, vi } from "vitest";

describe("social signal publisher", () => {
  it("builds a readable thread draft with source and signal metadata", async () => {
    const { buildSignalThreadDraft } = await import("./publisher");

    const draft = buildSignalThreadDraft({
      id: "news-1",
      title: "OpenAI launches GPT-X",
      summary: "A new multimodal model is now available.",
      url: "https://openai.com/index/gpt-x",
      source: "provider-blog",
      related_provider: "OpenAI",
      related_model_ids: ["model-1"],
      published_at: "2026-03-16T12:00:00.000Z",
      metadata: {
        signal_type: "launch",
      },
    });

    expect(draft.title).toBe("OpenAI launches GPT-X");
    expect(draft.content).toContain("OpenAI launch signal");
    expect(draft.content).toContain("Source: Provider blog");
    expect(draft.content).toContain("Original update: https://openai.com/index/gpt-x");
    expect(draft.metadata).toEqual(
      expect.objectContaining({
        news_item_id: "news-1",
        signal_type: "launch",
        source: "provider-blog",
        url: "https://openai.com/index/gpt-x",
        related_provider: "OpenAI",
      })
    );
  });

  it("caps X candidates and favors stronger sources during bootstrap", async () => {
    const { pickSignalPublishCandidates } = await import("./publisher");

    const now = Date.parse("2026-03-16T12:00:00.000Z");
    const items = [
      {
        id: "provider-pricing",
        title: "OpenAI pricing update",
        source: "provider-blog",
        category: "pricing",
        published_at: "2026-03-16T11:30:00.000Z",
      },
      {
        id: "aa-benchmark",
        title: "Benchmark shift",
        source: "artificial-analysis",
        category: "benchmark",
        published_at: "2026-03-16T11:40:00.000Z",
      },
      {
        id: "x-1",
        title: "Provider X post",
        source: "x-twitter",
        published_at: "2026-03-16T11:50:00.000Z",
      },
      {
        id: "x-2",
        title: "Another X post",
        source: "x-twitter",
        published_at: "2026-03-16T11:55:00.000Z",
      },
    ];

    const picked = pickSignalPublishCandidates(items, new Set(), {
      hasExistingThreads: false,
      now,
    });

    expect(picked.map((item) => item.id)).toEqual([
      "provider-pricing",
      "aa-benchmark",
      "x-2",
    ]);
  });

  it("uses the shorter steady-state lookback and existing-key filtering", async () => {
    const { pickSignalPublishCandidates } = await import("./publisher");

    const now = Date.parse("2026-03-16T12:00:00.000Z");
    const items = [
      {
        id: "fresh-provider",
        title: "Fresh provider blog",
        source: "provider-blog",
        published_at: "2026-03-16T11:00:00.000Z",
      },
      {
        id: "fresh-benchmark",
        title: "Fresh benchmark",
        source: "open-llm-leaderboard",
        category: "benchmark",
        published_at: "2026-03-16T10:30:00.000Z",
      },
      {
        id: "fresh-research",
        title: "Fresh paper",
        source: "arxiv",
        published_at: "2026-03-16T09:30:00.000Z",
      },
      {
        id: "old-provider",
        title: "Old provider blog",
        source: "provider-blog",
        published_at: "2026-03-14T23:00:00.000Z",
      },
      {
        id: "already-published",
        title: "Already published benchmark",
        source: "artificial-analysis",
        category: "benchmark",
        published_at: "2026-03-16T11:45:00.000Z",
      },
    ];

    const picked = pickSignalPublishCandidates(items, new Set(["already-published"]), {
      hasExistingThreads: true,
      now,
    });

    expect(picked.map((item) => item.id)).toEqual([
      "fresh-benchmark",
      "fresh-provider",
      "fresh-research",
    ]);
    expect(picked).toHaveLength(3);
  });

  it("respects rolling source caps from already-published threads", async () => {
    const { pickSignalPublishCandidates } = await import("./publisher");

    const now = Date.parse("2026-03-16T12:00:00.000Z");
    const items = [
      {
        id: "provider-pricing",
        title: "Provider pricing update",
        source: "provider-blog",
        category: "pricing",
        published_at: "2026-03-16T11:30:00.000Z",
      },
      {
        id: "aa-benchmark",
        title: "Benchmark shift",
        source: "artificial-analysis",
        category: "benchmark",
        published_at: "2026-03-16T11:20:00.000Z",
      },
      {
        id: "x-1",
        title: "Provider X post",
        source: "x-twitter",
        published_at: "2026-03-16T11:10:00.000Z",
      },
    ];

    const picked = pickSignalPublishCandidates(items, new Set(), {
      hasExistingThreads: true,
      existingSourceCounts: new Map([
        ["provider-blog", 2],
        ["artificial-analysis", 1],
      ]),
      now,
    });

    expect(picked.map((item) => item.id)).toEqual(["x-1"]);
  });

  it("publishes recent signals into commons with a platform-managed actor", async () => {
    const { publishRecentSignalsToCommons } = await import("./publisher");

    const threadUpdates: Array<{ values: Record<string, unknown>; id: string }> = [];
    const mediaInsert = vi.fn(async () => ({ error: null }));
    const recentPublishedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const createdActorId = "actor-pipeline";
    let createdThreadCount = 0;
    let createdPostCount = 0;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "agents") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: "agent-1",
                    slug: "pipeline-engineer",
                    name: "Pipeline Engineer",
                    description: "Tracks trusted updates",
                    owner_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "network_actors") {
          return {
            select: () => ({
              eq: (column: string, value: string) => {
                if (column === "agent_id") {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                }

                if (column === "handle") {
                  return {
                    eq: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  };
                }

                throw new Error(`Unexpected eq column on network_actors: ${column}=${value}`);
              },
            }),
            insert: (values: Record<string, unknown>) => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: createdActorId,
                    ...values,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: { id: "admin-1" },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "social_communities") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "community-models" },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "model_news") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: "news-1",
                        title: "OpenAI pricing update",
                        summary: "Pricing changed for GPT access.",
                        url: "https://openai.com/pricing",
                        source: "provider-blog",
                        category: "pricing",
                        related_provider: "OpenAI",
                        related_model_ids: ["model-1"],
                        published_at: recentPublishedAt,
                        metadata: {},
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "social_threads") {
          return {
            select: (_columns?: string, options?: { count?: "exact"; head?: boolean }) => {
              if (options?.head) {
                return Promise.resolve({ count: 0, error: null });
              }

              return {
                eq: () => ({
                  gte: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: [],
                        error: null,
                      }),
                    }),
                  }),
                  order: () => ({
                    limit: async () => ({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              };
            },
            insert: (values: Record<string, unknown>) => ({
              select: () => ({
                single: async () => {
                  createdThreadCount += 1;
                  return {
                    data: {
                      id: `thread-${createdThreadCount}`,
                      ...values,
                    },
                    error: null,
                  };
                },
              }),
            }),
            update: (values: Record<string, unknown>) => ({
              eq: async (_column: string, id: string) => {
                threadUpdates.push({ values, id });
                return { error: null };
              },
            }),
          };
        }

        if (table === "social_posts") {
          return {
            insert: (values: Record<string, unknown>) => ({
              select: () => ({
                single: async () => {
                  createdPostCount += 1;
                  return {
                    data: {
                      id: `post-${createdPostCount}`,
                      ...values,
                    },
                    error: null,
                  };
                },
              }),
            }),
          };
        }

        if (table === "social_post_media") {
          return {
            insert: mediaInsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await publishRecentSignalsToCommons(supabase as never);

    expect(result).toEqual(
      expect.objectContaining({
        actorHandle: "pipeline-engineer",
        candidateCount: 1,
        publishedCount: 1,
        publishedNewsIds: ["news-1"],
      })
    );
    expect(threadUpdates).toEqual([
      {
        id: "thread-1",
        values: expect.objectContaining({
          root_post_id: "post-1",
        }),
      },
    ]);
    expect(mediaInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        post_id: "post-1",
        media_type: "link_preview",
        url: "https://openai.com/pricing",
      }),
    ]);
  });
});
