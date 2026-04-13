import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelCard } from "./model-card";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children: React.ReactNode;
    "aria-label"?: string;
  }) => (
    <a href={href} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/shared/rank-badge", () => ({
  RankBadge: ({ rank }: { rank: number | null }) => <span>Rank {rank ?? "—"}</span>,
}));

vi.mock("@/components/shared/category-badge", () => ({
  CategoryBadge: ({ category }: { category: string }) => <span>{category}</span>,
}));

vi.mock("@/lib/format", () => ({
  formatNumber: (value: number | null | undefined) => String(value ?? 0),
}));

vi.mock("@/lib/models/presentation", () => ({
  getModelDisplayDescription: () => ({
    text: "Fast, lower-cost general assistant.",
  }),
  getParameterDisplay: () => ({
    label: "27B",
  }),
}));

vi.mock("@/lib/models/market-value", () => ({
  formatMarketValue: () => "$1.2M",
}));

vi.mock("@/lib/models/pricing", () => ({
  getPublicPricingSummary: () => ({
    compactLabel: "API access",
    compactDisplay: "$0.40 / 1M tokens",
  }),
}));

describe("ModelCard", () => {
  it("renders pricing, value, and open-weight state for a launchable model card", () => {
    render(
      <ModelCard
        model={{
          id: "model_1",
          slug: "gemma-4-27b",
          name: "Gemma 4 27B",
          provider: "Google",
          category: "multimodal",
          overall_rank: 2,
          rankings: [{ ranking_type: "overall", rank: 2, previous_rank: 3 } as never],
          hf_downloads: 4200,
          hf_likes: 310,
          market_cap_estimate: 1200000,
          is_open_weights: true,
          description: "ignored",
          short_description: "ignored",
          model_pricing: [],
        } as never}
      />
    );

    expect(
      screen.getByRole("link", { name: /Gemma 4 27B by Google, ranked #2/i })
    ).toHaveAttribute("href", "/models/gemma-4-27b");
    expect(screen.getByText("Rank 2")).toBeInTheDocument();
    expect(screen.getByText("multimodal")).toBeInTheDocument();
    expect(screen.getByText("Fast, lower-cost general assistant.")).toBeInTheDocument();
    expect(screen.getByText("27B")).toBeInTheDocument();
    expect(screen.getByText("4200")).toBeInTheDocument();
    expect(screen.getByText("310")).toBeInTheDocument();
    expect(screen.getByText("API access")).toBeInTheDocument();
    expect(screen.getByText("$0.40 / 1M tokens")).toBeInTheDocument();
    expect(screen.getByText("$1.2M")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });
});
