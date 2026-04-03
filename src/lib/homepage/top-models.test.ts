import { describe, expect, it } from "vitest";

import { selectHomepageTopModelIds } from "./top-models";

describe("selectHomepageTopModelIds", () => {
  const now = Date.parse("2026-04-02T00:00:00Z");

  it("prioritizes enterprise traction and real-world usage over a single raw rank", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "economic-only",
          overall_rank: 42,
          economic_footprint_score: 95,
          adoption_score: 42,
          capability_score: 50,
          quality_score: 58,
          popularity_score: 40,
          release_date: "2025-05-01",
        },
        {
          id: "balanced-enterprise-leader",
          overall_rank: 5,
          economic_footprint_score: 89,
          adoption_score: 86,
          capability_score: 91,
          quality_score: 90,
          popularity_score: 72,
          release_date: "2026-02-10",
        },
        {
          id: "quality-only",
          overall_rank: 14,
          economic_footprint_score: 55,
          adoption_score: 44,
          capability_score: 96,
          quality_score: 97,
          popularity_score: 30,
          release_date: "2026-01-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("balanced-enterprise-leader");
    expect(ids).toContain("quality-only");
  });

  it("does not let legacy footprint leaders outrank stronger current top models", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "legacy-footprint-winner",
          overall_rank: 42,
          economic_footprint_score: 89.1,
          adoption_score: 87.5,
          capability_score: 77.8,
          quality_score: 68.7,
          popularity_score: 63,
          release_date: "2024-12-17",
        },
        {
          id: "current-top-model",
          overall_rank: 12,
          economic_footprint_score: 71.6,
          adoption_score: 90.6,
          capability_score: 78.1,
          quality_score: 77.3,
          popularity_score: 65.3,
          release_date: "2025-06-17",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-top-model");
  });

  it("penalizes stale legacy leaders when newer top models are otherwise comparable", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "legacy-o1-shape",
          overall_rank: 45,
          economic_footprint_score: 89.1,
          adoption_score: 87.5,
          capability_score: 77.8,
          quality_score: 68.1,
          popularity_score: 62.3,
          release_date: "2024-12-17",
        },
        {
          id: "current-gpt-4-1-shape",
          overall_rank: 36,
          economic_footprint_score: 77.6,
          adoption_score: 89.8,
          capability_score: 77.1,
          quality_score: 68.2,
          popularity_score: 62.2,
          release_date: "2025-04-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-gpt-4-1-shape");
  });

  it("discounts old footprint and adoption signals when a newer peer is otherwise close", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "legacy-o1-like",
          overall_rank: 8,
          economic_footprint_score: 95,
          adoption_score: 93,
          capability_score: 79,
          quality_score: 73,
          popularity_score: 68,
          release_date: "2024-09-12",
        },
        {
          id: "current-frontier-peer",
          overall_rank: 10,
          economic_footprint_score: 86,
          adoption_score: 90,
          capability_score: 84,
          quality_score: 82,
          popularity_score: 66,
          release_date: "2026-01-18",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-frontier-peer");
  });

  it("keeps specialized image and audio variants from crowding out mainstream top models", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "image-specialist",
          slug: "google-gemini-2-5-flash-image",
          name: "Gemini 2.5 Flash Image",
          category: "image_generation",
          overall_rank: 18,
          economic_footprint_score: 82,
          adoption_score: 87,
          capability_score: 76,
          quality_score: 73,
          popularity_score: 62,
          release_date: "2025-05-20",
        },
        {
          id: "general-frontier-model",
          slug: "openai-gpt-4-1",
          name: "GPT-4.1",
          category: "multimodal",
          overall_rank: 28,
          economic_footprint_score: 77,
          adoption_score: 89,
          capability_score: 76,
          quality_score: 72,
          popularity_score: 61,
          release_date: "2025-04-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("general-frontier-model");
  });

  it("penalizes preview-style rows when a stable peer is otherwise comparable", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "preview-row",
          slug: "google-gemini-2-5-pro-preview-05-06",
          name: "Gemini 2.5 Pro Preview 05-06",
          category: "multimodal",
          overall_rank: 14,
          economic_footprint_score: 76,
          adoption_score: 75,
          capability_score: 79,
          quality_score: 71,
          popularity_score: 56,
          release_date: "2025-05-07",
        },
        {
          id: "stable-row",
          slug: "openai-gpt-4-1",
          name: "GPT-4.1",
          category: "multimodal",
          overall_rank: 24,
          economic_footprint_score: 77,
          adoption_score: 83,
          capability_score: 76,
          quality_score: 72,
          popularity_score: 60,
          release_date: "2025-04-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("stable-row");
  });
});
