import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VisualComparison } from "./visual-comparison";

vi.mock("@/components/charts/benchmark-radar-overlay", () => ({
  BenchmarkRadarOverlay: ({
    models,
  }: {
    models: Array<{ modelName: string }>;
  }) => <div>{`BenchmarkRadar:${models.map((model) => model.modelName).join(",")}`}</div>,
}));

vi.mock("@/components/charts/price-comparison", () => ({
  PriceComparison: ({
    models,
  }: {
    models: Array<{ name: string }>;
  }) => <div>{`PriceComparison:${models.map((model) => model.name).join(",")}`}</div>,
}));

vi.mock("@/components/charts/speed-cost-scatter", () => ({
  SpeedCostScatter: ({
    data,
  }: {
    data: Array<{ name: string }>;
  }) => <div>{`SpeedCost:${data.map((item) => item.name).join(",")}`}</div>,
}));

vi.mock("@/lib/constants/providers", () => ({
  getProviderBrand: (provider: string) => ({ color: provider === "OpenAI" ? "#10b981" : "#6366f1" }),
}));

vi.mock("./compare-helpers", () => ({
  getTrustedBenchmarkScores: (model: { benchmark_scores?: Array<unknown> }) =>
    model.benchmark_scores ?? [],
}));

describe("VisualComparison", () => {
  it("renders all visual compare charts when benchmark and pricing data exist", () => {
    render(
      <VisualComparison
        models={[
          {
            name: "Alpha",
            provider: "OpenAI",
            benchmark_scores: [
              {
                score: 88.2,
                benchmarks: {
                  name: "MMLU",
                  max_score: 100,
                },
              },
            ],
            model_pricing: [
              {
                input_price_per_million: 2.5,
                output_price_per_million: 8,
                median_output_tokens_per_second: 120,
              },
            ],
          } as never,
          {
            name: "Beta",
            provider: "Anthropic",
            benchmark_scores: [],
            model_pricing: [
              {
                input_price_per_million: 4,
                output_price_per_million: 10,
                median_output_tokens_per_second: 90,
              },
            ],
          } as never,
        ]}
      />
    );

    expect(screen.getByText("Benchmark Comparison")).toBeInTheDocument();
    expect(screen.getByText("Price Comparison")).toBeInTheDocument();
    expect(screen.getByText("Speed vs Cost")).toBeInTheDocument();
    expect(screen.getByText("BenchmarkRadar:Alpha")).toBeInTheDocument();
    expect(screen.getByText("PriceComparison:Alpha,Beta")).toBeInTheDocument();
    expect(screen.getByText("SpeedCost:Alpha,Beta")).toBeInTheDocument();
  });

  it("omits charts when the underlying data is absent", () => {
    render(
      <VisualComparison
        models={[
          {
            name: "Alpha",
            provider: "OpenAI",
            benchmark_scores: [],
            model_pricing: [],
          } as never,
        ]}
      />
    );

    expect(screen.queryByText("Benchmark Comparison")).not.toBeInTheDocument();
    expect(screen.queryByText("Price Comparison")).not.toBeInTheDocument();
    expect(screen.queryByText("Speed vs Cost")).not.toBeInTheDocument();
  });
});
