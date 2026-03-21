export interface ScenePerformanceInput {
  isVisible: boolean;
  isScrolling: boolean;
  prefersReducedMotion: boolean;
  qualityBias: number;
}

export interface ScenePerformanceProfile {
  shouldAnimate: boolean;
  targetDpr: number;
  connectionBudget: number;
  simulationStride: number;
  connectionRefreshStride: number;
}

function clampQualityBias(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0.5, value));
}

export function getScenePerformanceProfile(
  input: ScenePerformanceInput
): ScenePerformanceProfile {
  if (input.prefersReducedMotion || !input.isVisible) {
    return {
      shouldAnimate: false,
      targetDpr: 1,
      connectionBudget: 0,
      simulationStride: 4,
      connectionRefreshStride: 4,
    };
  }

  const qualityBias = clampQualityBias(input.qualityBias);

  if (input.isScrolling) {
    return {
      shouldAnimate: true,
      targetDpr: 1,
      connectionBudget: Math.round(80 * qualityBias),
      simulationStride: 1,
      connectionRefreshStride: 3,
    };
  }

  if (qualityBias < 0.8) {
    return {
      shouldAnimate: true,
      targetDpr: 1,
      connectionBudget: Math.round(180 * qualityBias),
      simulationStride: 1,
      connectionRefreshStride: 2,
    };
  }

  return {
    shouldAnimate: true,
    targetDpr: 1,
    connectionBudget: 200,
    simulationStride: 1,
    connectionRefreshStride: 1,
  };
}
