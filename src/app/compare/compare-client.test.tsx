import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompareClient } from "./compare-client";

const mockReplace = vi.fn();
const mockMutate = vi.fn();
const mockModelCompared = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock("swr", () => ({
  useSWRConfig: () => ({
    mutate: mockMutate,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => <span>{provider}</span>,
}));

vi.mock("@/components/compare/share-comparison", () => ({
  ShareComparison: ({ slugs }: { slugs: string[] }) => <div>{`Share:${slugs.join(",")}`}</div>,
}));

vi.mock("@/lib/posthog", () => ({
  analytics: {
    modelCompared: (...args: unknown[]) => mockModelCompared(...args),
  },
}));

vi.mock("./_components/model-selector", () => ({
  ModelSelector: () => <div>ModelSelector</div>,
}));

vi.mock("./_components/overview-table", () => ({
  OverviewTable: () => <div>OverviewTable</div>,
}));

vi.mock("./_components/benchmarks-table", () => ({
  BenchmarksTable: () => <div>BenchmarksTable</div>,
}));

vi.mock("./_components/pricing-table", () => ({
  PricingTable: () => <div>PricingTable</div>,
}));

vi.mock("./_components/visual-comparison", () => ({
  VisualComparison: () => <div>VisualComparison</div>,
}));

vi.mock("./_components/compare-helpers", () => ({
  getTrustedBenchmarkScores: (model: { benchmark_scores?: Array<unknown> }) =>
    model.benchmark_scores ?? [],
}));

describe("CompareClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty compare state when fewer than two models are selected", () => {
    render(
      <CompareClient
        allModels={[]}
        initialModels={[
          {
            id: "model-1",
            slug: "alpha",
            name: "Alpha",
            provider: "OpenAI",
            category: "llm",
            benchmark_scores: [],
          } as never,
        ]}
        initialSlugs={["alpha"]}
        initialModelSignals={{ alpha: null }}
        initialAccessOffers={{ alpha: null }}
      />
    );

    expect(screen.getByText("Compare Models")).toBeInTheDocument();
    expect(screen.getByText("Select Models to Compare")).toBeInTheDocument();
    expect(screen.getByText("ModelSelector")).toBeInTheDocument();
    expect(screen.queryByText("Share:alpha")).not.toBeInTheDocument();
    expect(mockModelCompared).not.toHaveBeenCalled();
  });

  it("renders compare sections, tracks the initial comparison, and removes a model", async () => {
    const user = userEvent.setup();

    render(
      <CompareClient
        allModels={[]}
        initialModels={[
          {
            id: "model-1",
            slug: "alpha",
            name: "Alpha",
            provider: "OpenAI",
            category: "llm",
            benchmark_scores: [
              {
                benchmarks: { slug: "mmlu", name: "MMLU", category: "reasoning" },
              },
            ],
          } as never,
          {
            id: "model-2",
            slug: "beta",
            name: "Beta",
            provider: "Anthropic",
            category: "multimodal",
            benchmark_scores: [],
          } as never,
        ]}
        initialSlugs={["alpha", "beta"]}
        initialModelSignals={{ alpha: null, beta: null }}
        initialAccessOffers={{ alpha: null, beta: null }}
      />
    );

    expect(screen.getByText("Share:alpha,beta")).toBeInTheDocument();
    expect(screen.getByText("OverviewTable")).toBeInTheDocument();
    expect(screen.getByText("BenchmarksTable")).toBeInTheDocument();
    expect(screen.getByText("PricingTable")).toBeInTheDocument();
    expect(screen.getByText("VisualComparison")).toBeInTheDocument();
    expect(mockModelCompared).toHaveBeenCalledWith(["model-1", "model-2"]);

    await user.click(screen.getAllByRole("button")[0]);

    expect(mockReplace).toHaveBeenCalledWith("/compare?models=beta", {
      scroll: false,
    });
    expect(screen.queryByText("Share:alpha,beta")).not.toBeInTheDocument();
  });
});
