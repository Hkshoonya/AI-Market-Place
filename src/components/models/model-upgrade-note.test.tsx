import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModelUpgradeNote } from "./model-upgrade-note";

describe("ModelUpgradeNote", () => {
  it("renders upgrade notes with the what changed badge", () => {
    render(
      <ModelUpgradeNote
        model={{
          description:
            "Anthropic's latest generally available flagship. Improves on Opus 4.6 for advanced software engineering and self-verification.",
        }}
      />
    );

    expect(screen.getByText("What changed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Improves on Opus 4.6 for advanced software engineering and self-verification."
      )
    ).toBeInTheDocument();
  });

  it("renders lifecycle notes with the lifecycle badge", () => {
    render(
      <ModelUpgradeNote
        model={{
          description:
            "Previous full o-series reasoning model. Later o3 and o4 releases are the newer frontier generation.",
        }}
        compact
      />
    );

    expect(screen.getByText("Lifecycle")).toBeInTheDocument();
    expect(screen.getByText("Previous full o-series reasoning model.")).toBeInTheDocument();
  });

  it("renders nothing for generic descriptions", () => {
    const { container } = render(
      <ModelUpgradeNote
        model={{
          description:
            "Balanced multimodal model for production workflows with long context and tool use.",
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
