import { describe, expect, it } from "vitest";

import {
  getModelUpgradeHighlight,
  getModelUpgradeHighlightKind,
} from "./upgrade-highlights";

describe("getModelUpgradeHighlight", () => {
  it("returns upgrade summaries for latest-generation descriptions", () => {
    expect(
      getModelUpgradeHighlight({
        description:
          "Anthropic's latest generally available flagship. Improves on Opus 4.6 for advanced software engineering and self-verification.",
      })
    ).toBe("Improves on Opus 4.6 for advanced software engineering and self-verification.");
    expect(
      getModelUpgradeHighlightKind({
        description:
          "Anthropic's latest generally available flagship. Improves on Opus 4.6 for advanced software engineering and self-verification.",
      })
    ).toBe("upgrade");
  });

  it("returns lifecycle summaries for previous-generation descriptions", () => {
    expect(
      getModelUpgradeHighlight({
        description:
          "Previous full o-series reasoning model. Later o3 and o4 releases are the newer frontier generation.",
      })
    ).toBe("Previous full o-series reasoning model.");
    expect(
      getModelUpgradeHighlightKind({
        description:
          "Previous full o-series reasoning model. Later o3 and o4 releases are the newer frontier generation.",
      })
    ).toBe("lifecycle");
  });

  it("falls back to the flagship sentence when that is the only meaningful upgrade cue", () => {
    expect(
      getModelUpgradeHighlight({
        description:
          "OpenAI's latest GPT-5 generation model with stronger reasoning, coding, and instruction-following than prior GPT-5 releases.",
      })
    ).toBe(
      "OpenAI's latest GPT-5 generation model with stronger reasoning, coding, and instruction-following than prior GPT-5 releases."
    );
  });

  it("ignores generic descriptions without upgrade or lifecycle language", () => {
    expect(
      getModelUpgradeHighlight({
        description:
          "Balanced multimodal model for production workflows with long context and tool use.",
      })
    ).toBeNull();
    expect(
      getModelUpgradeHighlightKind({
        description:
          "Balanced multimodal model for production workflows with long context and tool use.",
      })
    ).toBeNull();
  });
});
