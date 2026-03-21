import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("swr", () => ({
  default: vi.fn(),
}));

vi.mock("./chart-controls", () => ({
  ChartControls: () => <div>chart controls</div>,
  useChartFilters: () => ({
    filters: { category: "", providers: [] as string[] },
    setFilters: vi.fn(),
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScatterChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Scatter: () => <div>scatter</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ZAxis: () => null,
}));

import useSWR from "swr";
import QualityPriceFrontier from "./quality-price-frontier";

const mockedUseSWR = vi.mocked(useSWR);

describe("QualityPriceFrontier", () => {
  it("keeps the accessible summary stable when the API returns null pricing", () => {
    mockedUseSWR.mockReturnValue({
      data: {
        data: [
          {
            slug: "model-with-price",
            name: "Model With Price",
            provider: "OpenAI",
            qualityScore: 88.4,
            inputPrice: 2.5,
            parameterCount: null,
            rank: 4,
          },
          {
            slug: "model-without-price",
            name: "Model Without Price",
            provider: "Meta",
            qualityScore: 75.4,
            inputPrice: null,
            parameterCount: 400000000000,
            rank: 107,
          },
        ],
      },
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useSWR>);

    render(<QualityPriceFrontier />);

    expect(
      screen.getByText(/Model With Price by OpenAI, quality score 88.4, input price \$2.50 per million tokens, rank 4\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Model Without Price by Meta, quality score 75.4, input price pricing unavailable, rank 107\./i)
    ).toBeInTheDocument();
  });
});
