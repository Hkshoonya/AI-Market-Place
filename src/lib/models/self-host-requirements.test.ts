import { describe, expect, it } from "vitest";

import { getSelfHostRequirements } from "./self-host-requirements";

describe("getSelfHostRequirements", () => {
  it("returns explicit cloud GPU guidance for larger open-weight models", () => {
    const summary = getSelfHostRequirements({
      isOpenWeights: true,
      parameterCount: 31_000_000_000,
      contextWindow: 262_000,
      modalities: ["text", "image"],
      category: "multimodal",
    });

    expect(summary).not.toBeNull();
    expect(summary?.bestFitLabel).toBe("Cloud server you control");
    expect(summary?.gpuMemoryLabel).toBe("48GB+ GPU memory");
    expect(summary?.sizeLabel).toBe("31B parameters");
    expect(summary?.notes).toContain(
      "Image and audio features usually need more memory than text-only use."
    );
    expect(summary?.notes).toContain(
      "Very long context windows increase memory use, especially when you push the model hard."
    );
  });

  it("returns high-memory guidance for video models even without parameter counts", () => {
    const summary = getSelfHostRequirements({
      isOpenWeights: true,
      category: "video",
      modalities: ["video"],
      name: "Open Video Model",
    });

    expect(summary).not.toBeNull();
    expect(summary?.bestFitLabel).toBe("High-memory cloud GPU");
    expect(summary?.gpuMemoryLabel).toBe("80GB+ GPU memory");
  });
});
