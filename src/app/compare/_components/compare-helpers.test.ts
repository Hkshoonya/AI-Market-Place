import { describe, expect, it } from "vitest";

import { getCompareAccessLabel, getCompareDeploymentLabel } from "./compare-helpers";

describe("compare deployability helpers", () => {
  it("prefers explicit self-host and deploy signals over generic open-weight status", () => {
    expect(
      getCompareDeploymentLabel({
        model: { is_open_weights: true },
        signal: {
          title: "MiniMax self-host release",
          signalType: "open_source",
          signalLabel: "Open Source",
          signalImportance: "high",
          publishedAt: "2026-03-31T00:00:00.000Z",
          source: "provider-deployment-signals",
          relatedProvider: "MiniMax",
        },
        accessOffer: null,
      })
    ).toBe("Self-Host");

    expect(
      getCompareDeploymentLabel({
        model: { is_open_weights: false },
        signal: {
          title: "Now on Ollama Cloud",
          signalType: "api",
          signalLabel: "API",
          signalImportance: "medium",
          publishedAt: "2026-03-31T00:00:00.000Z",
          source: "ollama-library",
          relatedProvider: "Z.ai",
        },
        accessOffer: null,
      })
    ).toBe("Deployable");
  });

  it("falls back to access offers and open-weight status", () => {
    expect(
      getCompareDeploymentLabel({
        model: { is_open_weights: false },
        signal: null,
        accessOffer: { actionLabel: "Deploy", monthlyPriceLabel: "Custom" },
      })
    ).toBe("Deployable");

    expect(
      getCompareDeploymentLabel({
        model: { is_open_weights: true },
        signal: null,
        accessOffer: null,
      })
    ).toBe("Open Weights");
  });

  it("formats access labels for compare tables", () => {
    expect(
      getCompareAccessLabel({
        actionLabel: "Deploy",
        monthlyPriceLabel: "Custom",
      })
    ).toBe("Deploy · Custom");
    expect(getCompareAccessLabel(null)).toBeNull();
  });
});
