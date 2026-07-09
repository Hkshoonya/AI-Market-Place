import type { SyncError } from "./types";

const DEFAULT_MAX_FAILURE_RATIO = 0.25;

export function classifyFetchFailures(input: {
  attempted: number;
  succeeded: number;
  failures: SyncError[];
  maxFailureRatio?: number;
}) {
  const maxFailureRatio = input.maxFailureRatio ?? DEFAULT_MAX_FAILURE_RATIO;
  const failureRatio = input.attempted > 0
    ? input.failures.length / input.attempted
    : 0;
  const blocking =
    input.failures.length > 0 &&
    (input.succeeded === 0 || failureRatio > maxFailureRatio);

  return {
    blocking,
    failureRatio,
    errors: blocking ? input.failures : [],
    warnings: blocking ? [] : input.failures,
  };
}
