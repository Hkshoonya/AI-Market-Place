import { describe, expect, it } from "vitest";
import { getScenePerformanceProfile } from "./scene-performance";

describe("getScenePerformanceProfile", () => {
  it("keeps full quality while idle and in view", () => {
    expect(
      getScenePerformanceProfile({
        isVisible: true,
        isScrolling: false,
        prefersReducedMotion: false,
        qualityBias: 1,
      })
    ).toMatchObject({
      shouldAnimate: true,
      targetDpr: 1,
      connectionBudget: 120,
      simulationStride: 1,
      connectionRefreshStride: 1,
    });
  });

  it("reduces budgets while scrolling without throttling core motion", () => {
    expect(
      getScenePerformanceProfile({
        isVisible: true,
        isScrolling: true,
        prefersReducedMotion: false,
        qualityBias: 1,
      })
    ).toMatchObject({
      shouldAnimate: true,
      targetDpr: 1,
      connectionBudget: 40,
      simulationStride: 1,
      connectionRefreshStride: 3,
    });
  });

  it("pauses non-essential animation when offscreen", () => {
    expect(
      getScenePerformanceProfile({
        isVisible: false,
        isScrolling: false,
        prefersReducedMotion: false,
        qualityBias: 1,
      })
    ).toMatchObject({
      shouldAnimate: false,
      connectionBudget: 0,
      simulationStride: 4,
      connectionRefreshStride: 4,
    });
  });

  it("respects reduced motion regardless of visibility", () => {
    expect(
      getScenePerformanceProfile({
        isVisible: true,
        isScrolling: false,
        prefersReducedMotion: true,
        qualityBias: 1,
      })
    ).toMatchObject({
      shouldAnimate: false,
      connectionBudget: 0,
      simulationStride: 4,
      connectionRefreshStride: 4,
    });
  });

  it("scales down quality when the browser budget is weak", () => {
    expect(
      getScenePerformanceProfile({
        isVisible: true,
        isScrolling: false,
        prefersReducedMotion: false,
        qualityBias: 0.65,
      })
    ).toMatchObject({
      shouldAnimate: true,
      targetDpr: 1,
      connectionBudget: 78,
      simulationStride: 1,
      connectionRefreshStride: 2,
    });
  });
});
