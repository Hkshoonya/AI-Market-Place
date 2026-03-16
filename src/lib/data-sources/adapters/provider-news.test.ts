import { describe, expect, it } from "vitest";

import { __testables } from "./provider-news";
import { classifyNewsSignal } from "@/lib/news/signals";

describe("provider-news health aggregation", () => {
  it("treats the source as healthy when at least one provider blog is reachable", () => {
    const summary = __testables.summarizeHealthChecks([
      { name: "OpenAI", ok: false, status: 403, latencyMs: 120 },
      { name: "Anthropic", ok: true, status: 200, latencyMs: 95 },
      { name: "Google", ok: false, status: 500, latencyMs: 200 },
    ]);

    expect(summary).toEqual(
      expect.objectContaining({
        healthy: true,
      })
    );
    expect(summary.message).toContain("1/3");
  });

  it("classifies pricing headlines consistently with X updates", () => {
    const signal = classifyNewsSignal("New API pricing for Claude with lower cost per million tokens");

    expect(signal).toEqual(
      expect.objectContaining({
        signalType: "pricing",
        category: "pricing",
        importance: "high",
      })
    );
  });
});
