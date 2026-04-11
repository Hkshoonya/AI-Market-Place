import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll: _scroll,
    ...props
  }: {
    href?: string;
    children?: ReactNode;
    scroll?: boolean;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: vi.fn(),
}));

vi.mock("@/components/models/leaderboard-explorer", () => ({
  default: () => <div data-testid="leaderboard-explorer" />,
}));

vi.mock("@/components/models/leaderboard-lens-nav", () => ({
  LeaderboardLensNav: ({ activeLens }: { activeLens: string }) => (
    <div data-testid="leaderboard-lens-nav">{activeLens}</div>
  ),
}));

vi.mock("@/components/charts/speed-cost-scatter", () => ({
  SpeedCostScatter: () => <div data-testid="speed-cost-scatter" />,
}));

vi.mock("@/components/charts/quality-distribution", () => ({
  QualityDistribution: () => <div data-testid="quality-distribution" />,
}));

vi.mock("@/components/charts/quality-price-frontier", () => ({
  default: () => <div data-testid="quality-price-frontier" />,
}));

vi.mock("@/components/charts/benchmark-heatmap", () => ({
  default: () => <div data-testid="benchmark-heatmap" />,
}));

vi.mock("@/components/charts/rank-timeline", () => ({
  default: () => <div data-testid="rank-timeline" />,
}));

vi.mock("@/components/models/market-value-badge", () => ({
  MarketValueBadge: () => <div data-testid="market-value-badge" />,
}));

vi.mock("@/components/shared/data-freshness-badge", () => ({
  DataFreshnessBadge: ({
    label,
    timestamp,
    detail,
  }: {
    label: string;
    timestamp: string | null | undefined;
    detail?: string | null;
  }) => (
    <div
      data-testid="freshness-badge"
      data-label={label}
      data-timestamp={timestamp ?? ""}
      data-detail={detail ?? ""}
    />
  ),
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: () => <div data-testid="provider-logo" />,
}));

import { createPublicClient } from "@/lib/supabase/public-server";
import LeaderboardsPage from "./page";

function createQuery<T>(data: T) {
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: T; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };

  return query;
}

describe("LeaderboardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const from = vi.fn((table: string) => {
      if (table === "models") {
        return {
          select: vi.fn((columns: string) => {
            if (columns.includes("name, slug, provider, category, status, overall_rank")) {
              return createQuery([
                {
                  name: "Navigator 1",
                  slug: "navigator-1",
                  provider: "OpenAI",
                  category: "agentic_browser",
                  status: "active",
                  overall_rank: 1,
                  category_rank: 1,
                  quality_score: 91,
                  value_score: 77,
                  is_open_weights: false,
                  hf_downloads: 1200,
                  popularity_score: 83,
                  adoption_score: 79,
                  adoption_rank: 1,
                  agent_score: 70,
                  agent_rank: 1,
                  popularity_rank: 1,
                  economic_footprint_score: 88,
                  economic_footprint_rank: 1,
                  market_cap_estimate: 250000000,
                  capability_score: 95,
                  capability_rank: 1,
                  usage_score: 84,
                  usage_rank: 1,
                  expert_score: 90,
                  expert_rank: 1,
                  balanced_rank: 1,
                },
              ]);
            }

            if (columns.includes("*, rankings(*), model_pricing(*), benchmark_scores(*, benchmarks(*)), elo_ratings(*)")) {
              return createQuery([
                {
                  id: "model-1",
                  slug: "navigator-1",
                  name: "Navigator 1",
                  provider: "OpenAI",
                  category: "agentic_browser",
                  status: "active",
                  overall_rank: 1,
                  quality_score: 91,
                  capability_score: 95,
                  adoption_score: 79,
                  economic_footprint_score: 88,
                  market_cap_estimate: 250000000,
                  popularity_score: 83,
                  agent_score: 70,
                  value_score: 77,
                  is_open_weights: false,
                  benchmark_scores: [],
                  elo_ratings: [],
                  model_pricing: [],
                },
              ]);
            }

            if (columns.includes("slug, name, provider, category, status, popularity_rank, popularity_score")) {
              return createQuery([
                {
                  slug: "preview-browser",
                  name: "Preview Browser",
                  provider: "OpenAI",
                  category: "agentic_browser",
                  status: "preview",
                  popularity_rank: 12,
                  popularity_score: 61,
                },
              ]);
            }

            return createQuery([]);
          }),
        };
      }

      if (table === "model_pricing") {
        return {
          select: vi.fn(() => createQuery([])),
        };
      }

      if (table === "model_news") {
        return {
          select: vi.fn(() => createQuery([{ published_at: "2026-03-20T12:00:00.000Z" }])),
        };
      }

      if (table === "deployment_platforms") {
        return {
          select: vi.fn(() => createQuery([])),
        };
      }

      if (table === "model_deployments") {
        return {
          select: vi.fn(() => createQuery([])),
        };
      }

      if (table === "data_sources") {
        return {
          select: vi.fn(() => createQuery([{ last_sync_at: "2026-03-20T11:00:00.000Z" }])),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.mocked(createPublicClient).mockReturnValue({ from } as never);
  });

  it("renders Browser Agents category links and the requested Capability lens", async () => {
    render(
      await LeaderboardsPage({
        searchParams: Promise.resolve({ lens: "capability" }),
      })
    );

    expect(screen.getByRole("heading", { name: /ai model leaderboards/i })).toBeInTheDocument();
    expect(screen.getByTestId("leaderboard-lens-nav")).toHaveTextContent("capability");
    expect(screen.getByRole("link", { name: /browser agents/i })).toHaveAttribute(
      "href",
      "/leaderboards/agentic_browser?lens=capability"
    );
    expect(screen.getByRole("heading", { name: /tracked non-active models/i })).toBeInTheDocument();
    expect(screen.getByText("Preview Browser")).toBeInTheDocument();
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute(
      "data-label",
      "Ranking signals refreshed"
    );
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute(
      "data-timestamp",
      "2026-03-20T11:00:00.000Z"
    );
    expect(screen.getByTestId("freshness-badge")).toHaveAttribute(
      "data-detail",
      "pipeline sync"
    );
    expect(
      screen.getByText(/keep Active Only on for the cleanest public view/i)
    ).toBeInTheDocument();
  });
});
