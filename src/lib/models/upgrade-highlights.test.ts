import { describe, expect, it } from "vitest";

import { getModelUpgradeHighlight } from "./upgrade-highlights";

describe("getModelUpgradeHighlight", () => {
  it("returns upgrade summaries for latest-generation descriptions", () => {
    expect(
      getModelUpgradeHighlight({
        description:
          "Anthropic's latest generally available flagship. Improves on Opus 4.6 for advanced software engineering and self-verification.",
      })
    ).toContain("Improves on Opus 4.6");
  });

  it("returns lifecycle summaries for previous-generation descriptions", () => {
    expect(
      getModelUpgradeHighlight({
        description:
          "Previous full o-series reasoning model. Later o3 and o4 releases are the newer frontier generation.",
      })
    ).toContain("Previous full o-series");
  });

  it("ignores generic descriptions without upgrade or lifecycle language", () => {
    expect(
      getModelUpgradeHighlight({
        description:
          "Balanced multimodal model for production workflows with long context and tool use.",
      })
    ).toBeNull();
  });
});
