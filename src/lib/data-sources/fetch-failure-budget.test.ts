import { describe, expect, it } from "vitest";
import { classifyFetchFailures } from "./fetch-failure-budget";

describe("classifyFetchFailures", () => {
  it("keeps isolated optional page failures as warnings", () => {
    const failures = [
      { message: "Optional provider page returned 401", context: "optional-page" },
    ];

    const result = classifyFetchFailures({
      attempted: 10,
      succeeded: 9,
      failures,
    });

    expect(result.blocking).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(failures);
    expect(result.failureRatio).toBe(0.1);
  });

  it("blocks when no upstream page succeeds", () => {
    const failures = [{ message: "Provider unavailable" }];

    const result = classifyFetchFailures({
      attempted: 1,
      succeeded: 0,
      failures,
    });

    expect(result.blocking).toBe(true);
    expect(result.errors).toEqual(failures);
    expect(result.warnings).toEqual([]);
  });

  it("blocks when failures exceed the bounded ratio", () => {
    const failures = [
      { message: "First provider unavailable" },
      { message: "Second provider unavailable" },
    ];

    const result = classifyFetchFailures({
      attempted: 4,
      succeeded: 2,
      failures,
    });

    expect(result.blocking).toBe(true);
    expect(result.failureRatio).toBe(0.5);
  });
});
