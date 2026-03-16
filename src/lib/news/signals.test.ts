import { describe, expect, it } from "vitest";

import { classifyNewsSignal } from "./signals";

describe("classifyNewsSignal", () => {
  it("detects launch-oriented updates", () => {
    expect(classifyNewsSignal("Introducing GPT-5, now available in the API")).toEqual(
      expect.objectContaining({
        signalType: "launch",
        importance: "high",
        category: "launch",
      })
    );
  });

  it("prioritizes benchmark signals over generic launch wording", () => {
    const summary = classifyNewsSignal(
      "Introducing a new model that tops the leaderboard with strong benchmark scores"
    );

    expect(summary.signalType).toBe("benchmark");
    expect(summary.category).toBe("benchmark");
    expect(summary.flags.launch).toBe(true);
    expect(summary.flags.benchmark).toBe(true);
    expect(summary.tags).toContain("benchmark");
  });

  it("classifies pricing announcements explicitly", () => {
    const summary = classifyNewsSignal("New lower pricing for GPT-4.1: $2 per million input tokens");

    expect(summary.signalType).toBe("pricing");
    expect(summary.category).toBe("pricing");
    expect(summary.flags.pricing).toBe(true);
  });

  it("falls back to a low-importance general update", () => {
    const summary = classifyNewsSignal("Company recap from this week's team offsite");

    expect(summary.signalType).toBe("general");
    expect(summary.category).toBe("announcement");
    expect(summary.importance).toBe("low");
    expect(summary.tags).toContain("update");
  });
});
