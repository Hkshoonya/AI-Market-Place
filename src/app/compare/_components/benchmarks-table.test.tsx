import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BenchmarksTable } from "./benchmarks-table";

vi.mock("./compare-helpers", () => ({
  getBenchmarkScore: (model: { slug: string }, benchmarkSlug: string) => {
    if (model.slug === "alpha" && benchmarkSlug === "mmlu") return 88.2;
    if (model.slug === "beta" && benchmarkSlug === "mmlu") return 82.4;
    return null;
  },
}));

describe("BenchmarksTable", () => {
  it("renders benchmark comparison rows when benchmarks are present", () => {
    render(
      <BenchmarksTable
        models={[
          { slug: "alpha", name: "Alpha" } as never,
          { slug: "beta", name: "Beta" } as never,
        ]}
        allBenchmarks={[
          { slug: "mmlu", name: "MMLU", category: "reasoning" },
        ]}
      />
    );

    expect(screen.getByText("Benchmarks")).toBeInTheDocument();
    expect(screen.getByText("MMLU")).toBeInTheDocument();
    expect(screen.getByText("88.2")).toBeInTheDocument();
    expect(screen.getByText("82.4")).toBeInTheDocument();
  });

  it("renders nothing when no benchmarks are available", () => {
    const { container } = render(
      <BenchmarksTable
        models={[{ slug: "alpha", name: "Alpha" } as never]}
        allBenchmarks={[]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
