import { describe, expect, it } from "vitest";

import { buildHomepageDeploymentSelections } from "./deployments";
import { buildHomepageLaunchSelections } from "./launches";

describe("buildHomepageLaunchSelections", () => {
  it("prefers recent provider launch signals over raw release-date ordering", () => {
    const now = Date.parse("2026-03-28T01:00:00.000Z");
    const models = [
      { id: "older-direct-launch", provider: "Z.ai", release_date: "2026-03-21" },
      { id: "newer-generic-upload", provider: "unknown", release_date: "2026-03-27" },
      { id: "second-launch", provider: "MiniMax", release_date: "2026-03-25" },
    ];

    const result = buildHomepageLaunchSelections(
      models,
      [
        {
          source: "x-twitter",
          published_at: "2026-03-27T11:21:04.000Z",
          related_provider: "Z.ai",
          related_model_ids: ["older-direct-launch"],
          metadata: { signal_type: "launch", signal_importance: "high" },
        },
        {
          source: "provider-blog",
          published_at: "2026-03-27T20:00:00.000Z",
          related_provider: "MiniMax",
          related_model_ids: ["second-launch"],
          metadata: { signal_type: "general", signal_importance: "low" },
        },
      ],
      2,
      now
    );

    expect(result).toEqual([
      expect.objectContaining({ model: expect.objectContaining({ id: "second-launch" }) }),
      expect.objectContaining({ model: expect.objectContaining({ id: "older-direct-launch" }) }),
    ]);
  });

  it("drops provider-news matches when the linked model belongs to a different provider", () => {
    const result = buildHomepageLaunchSelections(
      [{ id: "generic-video", provider: "nanoukader", release_date: "2026-03-22" }],
      [
        {
          source: "provider-blog",
          published_at: "2026-03-28T00:53:07.000Z",
          related_provider: "MiniMax",
          related_model_ids: ["generic-video"],
          metadata: { signal_type: "general", signal_importance: "low" },
        },
      ],
      1,
      Date.parse("2026-03-28T01:00:00.000Z")
    );

    expect(result).toEqual([
      expect.objectContaining({ model: expect.objectContaining({ id: "generic-video" }) }),
    ]);
    expect(result[0]?.surfacedAt).toBe("2026-03-22");
  });

  it("falls back to release date when recent launch evidence is unavailable", () => {
    const result = buildHomepageLaunchSelections(
      [
        { id: "one", release_date: "2026-03-20" },
        { id: "two", release_date: "2026-03-27" },
      ],
      [],
      1,
      Date.parse("2026-03-28T01:00:00.000Z")
    );

    expect(result).toEqual([
      expect.objectContaining({ model: expect.objectContaining({ id: "two" }) }),
    ]);
  });

  it("uses recent created_at for recognized providers when release_date is missing", () => {
    const result = buildHomepageLaunchSelections(
      [
        {
          id: "minimax-new",
          provider: "MiniMax",
          release_date: null,
          created_at: "2026-03-28T00:48:03.917541+00:00",
          quality_score: 61,
        },
        {
          id: "older-official",
          provider: "Google",
          release_date: "2026-03-25",
        },
      ],
      [],
      1,
      Date.parse("2026-03-28T03:00:00.000Z")
    );

    expect(result).toEqual([
      expect.objectContaining({ model: expect.objectContaining({ id: "minimax-new" }) }),
    ]);
    expect(result[0]?.surfacedAt).toBe("2026-03-28T00:48:03.917541+00:00");
  });

  it("does not resurface older launches just because the provider post was re-synced recently", () => {
    const result = buildHomepageLaunchSelections(
      [
        {
          id: "anthropic-claude-opus-4-6",
          provider: "Anthropic",
          release_date: "2026-02-04",
          created_at: "2026-02-28T19:34:00.044125+00:00",
          quality_score: 72.9,
          capability_score: 81.7,
        },
        {
          id: "real-new-launch",
          provider: "MiniMax",
          release_date: "2026-03-30",
          quality_score: 64,
        },
      ],
      [
        {
          source: "provider-blog",
          published_at: "2026-02-05T00:00:00.000Z",
          related_provider: "Anthropic",
          related_model_ids: ["anthropic-claude-opus-4-6"],
          metadata: { signal_type: "launch", signal_importance: "high" },
        },
      ],
      2,
      Date.parse("2026-04-01T15:00:00.000Z")
    );

    expect(result.map((entry) => entry.model.id)).toEqual(["real-new-launch"]);
  });

  it("skips low-signal created-at fallback rows when no release evidence exists", () => {
    const result = buildHomepageLaunchSelections(
      [
        {
          id: "generic-new-row",
          provider: "OpenAI",
          release_date: null,
          created_at: "2026-03-30T04:56:23.444611+00:00",
          quality_score: 0,
          capability_score: null,
          adoption_score: 52,
          economic_footprint_score: 22,
        },
        {
          id: "real-launch",
          provider: "Microsoft",
          release_date: "2026-03-30",
          created_at: "2026-03-30T16:58:51.385568+00:00",
        },
      ],
      [],
      2,
      Date.parse("2026-03-31T01:00:00.000Z")
    );

    expect(result.map((entry) => entry.model.id)).toEqual(["real-launch"]);
  });
});

describe("buildHomepageDeploymentSelections", () => {
  it("prefers recent direct Ollama and self-host deployment signals", () => {
    const result = buildHomepageDeploymentSelections(
      [
        { id: "glm-5", provider: "Z.ai" },
        { id: "minimax-m2-7", provider: "MiniMax" },
      ],
      [
        {
          source: "provider-deployment-signals",
          title: "GLM coding plan deployment guide",
          published_at: "2026-03-30T10:00:00.000Z",
          related_provider: "Z.ai",
          related_model_ids: ["glm-5"],
          metadata: { signal_type: "api", signal_importance: "medium" },
        },
        {
          source: "ollama-library",
          title: "MiniMax M2.7 is now available on Ollama Cloud",
          published_at: "2026-03-30T11:00:00.000Z",
          related_provider: "MiniMax",
          related_model_ids: ["minimax-m2-7"],
          metadata: { signal_type: "api", signal_importance: "medium" },
        },
      ],
      2,
      Date.parse("2026-03-31T01:00:00.000Z")
    );

    expect(result.map((entry) => entry.model.id)).toEqual(["minimax-m2-7", "glm-5"]);
    expect(result[0]).toEqual(
      expect.objectContaining({
        title: "MiniMax M2.7 is now available on Ollama Cloud",
        source: "ollama-library",
        signalType: "api",
      })
    );
  });

  it("ignores provider mismatches and stale deployment news", () => {
    const result = buildHomepageDeploymentSelections(
      [{ id: "kimi-k2", provider: "Moonshot AI" }],
      [
        {
          source: "provider-deployment-signals",
          title: "Kimi agent setup",
          published_at: "2026-02-01T00:00:00.000Z",
          related_provider: "Moonshot AI",
          related_model_ids: ["kimi-k2"],
          metadata: { signal_type: "api" },
        },
        {
          source: "provider-deployment-signals",
          title: "Wrong provider match",
          published_at: "2026-03-30T10:00:00.000Z",
          related_provider: "Z.ai",
          related_model_ids: ["kimi-k2"],
          metadata: { signal_type: "open_source" },
        },
      ],
      2,
      Date.parse("2026-03-31T01:00:00.000Z")
    );

    expect(result).toEqual([]);
  });
});
