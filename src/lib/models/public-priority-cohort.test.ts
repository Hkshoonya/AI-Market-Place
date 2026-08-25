import { describe, expect, it } from "vitest";

import { buildPublicPriorityModelCohort } from "./public-priority-cohort";

function candidate(overrides: Record<string, unknown>) {
  return {
    id: "model",
    slug: "provider-model",
    name: "Model",
    provider: "OpenAI",
    category: "llm",
    release_date: "2026-01-01",
    context_window: 128000,
    is_open_weights: false,
    is_api_available: true,
    overall_rank: 10,
    quality_score: 80,
    ...overrides,
  };
}

describe("buildPublicPriorityModelCohort", () => {
  it("keeps ranked canonical profiles and excludes endpoint variants", () => {
    const cohort = buildPublicPriorityModelCohort(
      [
        candidate({
          id: "variant",
          slug: "meta-muse-spark-1-2-contributor",
          name: "Muse Spark 1.2 Contributor",
          provider: "Meta",
          overall_rank: 1,
        }),
        candidate({
          id: "second",
          slug: "openai-second",
          name: "Second",
          overall_rank: 2,
        }),
        candidate({
          id: "first",
          slug: "openai-first",
          name: "First",
          overall_rank: 1,
        }),
      ],
      2
    );

    expect(cohort.map((model) => model.id)).toEqual(["first", "second"]);
  });
});
