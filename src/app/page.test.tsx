import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockCreateOptionalPublicClient = vi.fn();
const mockCreateOptionalAdminClient = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createOptionalPublicClient: () => mockCreateOptionalPublicClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createOptionalAdminClient: () => mockCreateOptionalAdminClient(),
}));

vi.mock("@/components/hero-section", () => ({
  HeroSection: () => <div data-testid="hero-section" />,
}));

vi.mock("@/components/charts/provider-market-share", () => ({
  ProviderMarketShare: () => <div data-testid="provider-market-share" />,
}));

vi.mock("@/components/charts/category-distribution", () => ({
  CategoryDistribution: () => <div data-testid="category-distribution" />,
}));

vi.mock("@/components/charts/top-movers", () => ({
  default: () => <div data-testid="top-movers" />,
}));

vi.mock("@/components/charts/quality-price-frontier", () => ({
  default: () => <div data-testid="quality-price-frontier" />,
}));

vi.mock("@/components/models/trending-models", () => ({
  TrendingModels: () => <div data-testid="trending-models" />,
}));

vi.mock("@/components/home/top-subscription-providers", () => ({
  TopSubscriptionProviders: () => <div data-testid="top-subscription-providers" />,
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: () => <div data-testid="provider-logo" />,
}));

vi.mock("@/components/models/market-value-badge", () => ({
  MarketValueBadge: () => <div data-testid="market-value-badge" />,
}));

vi.mock("@/components/ui/count-up", () => ({
  CountUp: ({ end }: { end: number }) => <span>{end}</span>,
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

function createMockSupabase({
  latestSignalAt,
  latestPipelineSyncAt,
}: {
  latestSignalAt?: string | null;
  latestPipelineSyncAt?: string | null;
}) {
  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          select: (_query?: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return Promise.resolve({ count: 0, error: null });
            }

            return {
              eq: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
              in: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
            };
          },
        };
      }

      if (table === "benchmarks") {
        return {
          select: (_query?: string, _options?: { count?: string; head?: boolean }) =>
            Promise.resolve({ count: 0, error: null }),
        };
      }

      if (table === "deployment_platforms") {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [],
                error: null,
              }),
          }),
        };
      }

      if (table === "model_deployments") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [],
                error: null,
              }),
          }),
        };
      }

      if (table === "model_news") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: latestSignalAt ? [{ published_at: latestSignalAt }] : [],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }

      if (table === "data_sources") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                not: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({
                        data: latestPipelineSyncAt
                          ? [{ last_sync_at: latestPipelineSyncAt }]
                          : [],
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("HomePage freshness badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOptionalAdminClient.mockReturnValue(null);
  });

  it("prefers latest pipeline sync timestamp over launch/news activity", async () => {
    mockCreateOptionalPublicClient.mockReturnValue(
      createMockSupabase({
        latestSignalAt: "2026-03-19T16:10:00.000Z",
        latestPipelineSyncAt: "2026-03-19T16:00:00.000Z",
      })
    );

    const { default: HomePage } = await import("./page");
    render(await HomePage());

    const badge = screen.getByTestId("freshness-badge");
    expect(badge).toHaveAttribute("data-label", "Market signals refreshed");
    expect(badge).toHaveAttribute("data-timestamp", "2026-03-19T16:00:00.000Z");
    expect(badge).toHaveAttribute("data-detail", "pipeline sync");
  });

  it("falls back to recent market updates when no pipeline sync timestamp exists", async () => {
    mockCreateOptionalPublicClient.mockReturnValue(
      createMockSupabase({
        latestSignalAt: "2026-03-19T16:10:00.000Z",
        latestPipelineSyncAt: null,
      })
    );

    const { default: HomePage } = await import("./page");
    render(await HomePage());

    const badge = screen.getByTestId("freshness-badge");
    expect(badge).toHaveAttribute("data-timestamp", "2026-03-19T16:10:00.000Z");
    expect(badge).toHaveAttribute("data-detail", "market updates");
  });
});
