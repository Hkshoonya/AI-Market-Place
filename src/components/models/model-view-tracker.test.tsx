import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelViewTracker } from "./model-view-tracker";

const mockModelViewed = vi.fn();

vi.mock("@/lib/posthog", () => ({
  analytics: {
    modelViewed: (...args: unknown[]) => mockModelViewed(...args),
  },
}));

describe("ModelViewTracker", () => {
  it("tracks a model view only once across rerenders", () => {
    const { rerender } = render(
      <ModelViewTracker modelId="model_123" modelName="Gemma 4 27B" />
    );

    rerender(<ModelViewTracker modelId="model_123" modelName="Gemma 4 27B" />);

    expect(mockModelViewed).toHaveBeenCalledTimes(1);
    expect(mockModelViewed).toHaveBeenCalledWith("model_123", "Gemma 4 27B");
  });
});
