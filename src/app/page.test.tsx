import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockCreateOptionalPublicClient = vi.fn();
const mockCreateOptionalAdminClient = vi.fn();
const mockHeroSection = vi.fn(
  ({
    marketSignalsTimestamp,
    marketSignalsDetail,
  }: {
    marketSignalsTimestamp?: string | null;
    marketSignalsDetail?: string | null;
  }) => (
    <div
      data-testid="hero-section"
      data-market-signals-timestamp={marketSignalsTimestamp ?? ""}
      data-market-signals-detail={marketSignalsDetail ?? ""}
    />
  )
);

vi.mock("@/lib/supabase/public-server", () => ({
  createOptionalPublicClient: () => mockCreateOptionalPublicClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createOptionalAdminClient: () => mockCreateOptionalAdminClient(),
}));

vi.mock("@/components/hero-section", () => ({
  HeroSection: (props: unknown) => mockHeroSection(props),
}));

vi.mock("@/components/charts/top-movers", () => ({
  default: () => <div data-testid="top-movers" />,
}));

vi.mock("@/components/models/trending-models", () => ({
  TrendingModels: () => <div data-testid="trending-models" />,
}));

vi.mock("@/components/home/homepage-mover-strip", () => ({
  HomepageMoverStrip: () => <div data-testid="homepage-mover-strip" />,
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

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function createMockSupabase({
  latestSignalAt,
  latestPipelineSyncAt,
  recentLaunchNews = [],
  recentDeploymentNews = [],
  activeModels = [],
}: {
  latestSignalAt?: string | null;
  latestPipelineSyncAt?: string | null;
  recentLaunchNews?: Array<Record<string, unknown>>;
  recentDeploymentNews?: Array<Record<string, unknown>>;
  activeModels?: Array<Record<string, unknown>>;
}) {
  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          select: (_query?: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return Promise.resolve({ count: 0, error: null });
            }

            const chain = {
              eq: () => chain,
              range: () =>
                Promise.resolve({
                  data: activeModels,
                  error: null,
                }),
              in: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
            };

            return chain;
          },
        };
      }

      if (table === "benchmarks") {
        return {
          select: () => Promise.resolve({ count: 0, error: null }),
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
          select: (query?: string) => {
            if (query === "published_at") {
              return {
                in: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({
                        data: latestSignalAt ? [{ published_at: latestSignalAt }] : [],
                        error: null,
                      }),
                  }),
                }),
              };
            }

            if (query?.includes("title, summary")) {
              return {
                in: () => ({
                  not: () => ({
                    gte: () => ({
                      order: () => ({
                        limit: () =>
                          Promise.resolve({
                            data: recentDeploymentNews,
                            error: null,
                          }),
                      }),
                    }),
                  }),
                }),
              };
            }

            return {
              in: () => ({
                not: () => ({
                  gte: () => ({
                    order: () => ({
                      limit: () =>
                        Promise.resolve({
                          data: recentLaunchNews,
                          error: null,
                        }),
                    }),
                  }),
                }),
              }),
            };
          },
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

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCreateOptionalAdminClient.mockReturnValue(null);
  });

  it("forwards the freshest pipeline sync metadata into the hero", async () => {
    mockCreateOptionalPublicClient.mockReturnValue(
      createMockSupabase({
        latestSignalAt: "2026-03-19T16:10:00.000Z",
        latestPipelineSyncAt: "2026-03-19T16:00:00.000Z",
      })
    );

    const { default: HomePage } = await import("./page");
    render(await HomePage());

    expect(screen.getByTestId("hero-section")).toHaveAttribute(
      "data-market-signals-timestamp",
      "2026-03-19T16:00:00.000Z"
    );
    expect(screen.getByTestId("hero-section")).toHaveAttribute(
      "data-market-signals-detail",
      "pipeline sync"
    );
  });

  it("falls back to market update freshness when there is no pipeline sync", async () => {
    mockCreateOptionalPublicClient.mockReturnValue(
      createMockSupabase({
        latestSignalAt: "2026-03-19T16:10:00.000Z",
        latestPipelineSyncAt: null,
      })
    );

    const { default: HomePage } = await import("./page");
    render(await HomePage());

    expect(screen.getByTestId("hero-section")).toHaveAttribute(
      "data-market-signals-timestamp",
      "2026-03-19T16:10:00.000Z"
    );
    expect(screen.getByTestId("hero-section")).toHaveAttribute(
      "data-market-signals-detail",
      "market updates"
    );
  });

  it("renders the mover strip and the concise top-models value proposition", async () => {
    mockCreateOptionalPublicClient.mockReturnValue(
      createMockSupabase({
        latestSignalAt: "2026-03-19T16:10:00.000Z",
        latestPipelineSyncAt: "2026-03-19T16:00:00.000Z",
      })
    );

    const { default: HomePage } = await import("./page");
    render(await HomePage());

    expect(screen.getByText("Top AI Models")).toBeInTheDocument();
    expect(screen.getByTestId("homepage-mover-strip")).toBeInTheDocument();
    expect(
      screen.getByText(/strongest current mix of quality, reach, pricing, and verified market signals/i)
    ).toBeInTheDocument();
  });

  it("replaces the seller CTA with broader API and tracking actions", async () => {
    mockCreateOptionalPublicClient.mockReturnValue(
      createMockSupabase({
        latestSignalAt: "2026-03-19T16:10:00.000Z",
        latestPipelineSyncAt: "2026-03-19T16:00:00.000Z",
      })
    );

    const { default: HomePage } = await import("./page");
    render(await HomePage());

    expect(
      screen.getByRole("heading", {
        name: /get the api or start tracking the market directly/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get the api/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start tracking/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/launches, pricing, benchmarks, and api changes live in the dedicated updates page/i)
    ).not.toBeInTheDocument();
  });
});
