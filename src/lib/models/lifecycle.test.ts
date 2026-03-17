import { describe, expect, it } from "vitest";

import {
  filterRankableModels,
  getLifecycleBadge,
  getLifecycleStatuses,
  inferLifecycleStatus,
  isRankableLifecycleStatus,
  normalizeLifecycleStatus,
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

  it("infers preview and beta lifecycle from model naming signals", () => {
    expect(inferLifecycleStatus("gpt-4-1106-preview")).toBe("preview");
    expect(inferLifecycleStatus("Gemini 3.1 Flash Lite Beta")).toBe("beta");
  });

  it("normalizes active status down to tracked non-active states when signals require it", () => {
    expect(normalizeLifecycleStatus("active", "openai-gpt-4o-realtime-preview")).toBe("preview");
    expect(normalizeLifecycleStatus("active", "legacy model")).toBe("deprecated");
  });

  it("preserves explicit non-active statuses", () => {
    expect(normalizeLifecycleStatus("deprecated", "gpt-4o")).toBe("deprecated");
    expect(normalizeLifecycleStatus("archived", "gpt-4o")).toBe("archived");
  });
});
