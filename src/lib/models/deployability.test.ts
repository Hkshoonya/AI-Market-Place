import { describe, expect, it } from "vitest";
import { getDeployabilityLabel } from "./deployability";

describe("getDeployabilityLabel", () => {
  it("prefers explicit self-host signals", () => {
    expect(
      getDeployabilityLabel({
        isOpenWeights: false,
        signal: {
          title: "Now open source",
          signalType: "open_source",
          signalLabel: "Open Source",
          signalImportance: "high",
          publishedAt: null,
          source: "provider-blog",
          relatedProvider: "MiniMax",
        },
      })
    ).toBe("Self-Host");
  });

  it("uses access-offer actions when there is no signal", () => {
    expect(
      getDeployabilityLabel({
        accessOffer: {
          actionLabel: "Deploy",
        },
      })
    ).toBe("Ready to Use");
  });

  it("falls back to open weights when no deployment signal exists", () => {
    expect(
      getDeployabilityLabel({
        isOpenWeights: true,
      })
    ).toBe("Open Weights");
  });

  it("keeps open-weight identity ahead of generic trial offers", () => {
    expect(
      getDeployabilityLabel({
        isOpenWeights: true,
        accessOffer: {
          actionLabel: "Start Free Trial",
        },
      })
    ).toBe("Open Weights");
  });
});
