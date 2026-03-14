import { describe, expect, it } from "vitest";

import {
  filterRankableModels,
  getLifecycleBadge,
  getLifecycleStatuses,
  isRankableLifecycleStatus,
  type LifecycleFilter,
} from "./lifecycle";

describe("model lifecycle helpers", () => {
  it("keeps only active models in the default ranking lifecycle", () => {
    expect(getLifecycleStatuses("active")).toEqual(["active"]);
  });

  it("includes tracked non-active states when lifecycle is widened", () => {
    const statuses = getLifecycleStatuses("all");

    expect(statuses).toEqual(
      expect.arrayContaining(["active", "beta", "preview", "deprecated", "archived"])
    );
  });

  it("treats only active models as rankable by default", () => {
    expect(isRankableLifecycleStatus("active")).toBe(true);
    expect(isRankableLifecycleStatus("deprecated")).toBe(false);
    expect(isRankableLifecycleStatus("preview")).toBe(false);
  });

  it("filters arbitrary model rows by lifecycle mode", () => {
    const models = [
      { slug: "active-model", status: "active" },
      { slug: "preview-model", status: "preview" },
      { slug: "deprecated-model", status: "deprecated" },
    ];

    expect(filterRankableModels(models, "active" satisfies LifecycleFilter)).toEqual([
      { slug: "active-model", status: "active" },
    ]);
    expect(filterRankableModels(models, "all" satisfies LifecycleFilter)).toHaveLength(3);
  });

  it("returns public badge metadata for non-active models", () => {
    expect(getLifecycleBadge("preview")).toMatchObject({
      label: "Preview",
      rankedByDefault: false,
    });
    expect(getLifecycleBadge("deprecated")).toMatchObject({
      label: "Deprecated",
      rankedByDefault: false,
    });
  });
});
