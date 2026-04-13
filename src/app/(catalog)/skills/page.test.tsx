import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockParseQueryResult = vi.fn();
const mockFormatMarketValue = vi.fn();
const mockGetPublicPricingSummary = vi.fn();
const mockBuildAccessOffersCatalog = vi.fn();
const mockGetBestAccessOfferForModel = vi.fn();
const mockPickBestModelSignals = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResult: (...args: unknown[]) => mockParseQueryResult(...args),
}));

vi.mock("@/lib/models/market-value", () => ({
  formatMarketValue: (...args: unknown[]) => mockFormatMarketValue(...args),
}));

vi.mock("@/lib/models/pricing", () => ({
  getPublicPricingSummary: (...args: unknown[]) => mockGetPublicPricingSummary(...args),
}));

vi.mock("@/lib/models/access-offers", () => ({
  buildAccessOffersCatalog: (...args: unknown[]) => mockBuildAccessOffersCatalog(...args),
  getBestAccessOfferForModel: (...args: unknown[]) => mockGetBestAccessOfferForModel(...args),
}));

vi.mock("@/lib/news/model-signals", () => ({
  pickBestModelSignals: (...args: unknown[]) => mockPickBestModelSignals(...args),
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => <span>{provider}</span>,
}));

vi.mock("@/components/shared/data-freshness-badge", () => ({
  DataFreshnessBadge: ({
    label,
    timestamp,
    detail,
  }: {
    label: string;
    timestamp: string | null;
    detail: string;
  }) => (
    <div>
      {label} {timestamp} {detail}
    </div>
  ),
}));

vi.mock("@/components/models/model-signal-badge", () => ({
  ModelSignalBadge: ({
    signal,
  }: {
    signal: { label: string };
  }) => <div>{signal.label}</div>,
}));

function createQueryResult<T>(data: T) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (value: { data: T; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };

  return chain;
}

describe("SkillsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockParseQueryResult.mockImplementation((response: { data: unknown }) => response.data);
    mockFormatMarketValue.mockImplementation((value: number | null) =>
      value == null ? "---" : `$${value}`
    );
    mockBuildAccessOffersCatalog.mockReturnValue({ catalog: true });
    mockGetBestAccessOfferForModel.mockImplementation((_catalog, modelId: string) => {
      if (modelId === "model-1") {
        return {
          platform: { name: "AI Market Runtime" },
          actionLabel: "Open Guided Setup",
          actionUrl: "https://example.com/runtime",
          score: 90,
          trustScore: 88,
          userValueScore: 91,
          partnerDisclosure: false,
        };
      }

      if (modelId === "model-2") {
        return {
          platform: { name: "Open Weights Hub" },
          actionLabel: "Run on your server",
          actionUrl: "https://example.com/server",
          score: 75,
          trustScore: 70,
          userValueScore: 72,
          partnerDisclosure: false,
        };
      }

      return null;
    });
    mockGetPublicPricingSummary.mockImplementation((model: { id: string }) => {
      if (model.id === "model-1") {
        return {
          compactPrice: 5,
          compactLabel: "per 1M tokens",
          compactDisplay: "$5.00",
        };
      }

      if (model.id === "model-2") {
        return {
          compactPrice: 0,
          compactLabel: "free tier",
          compactDisplay: "Free",
        };
      }

      return {
        compactPrice: null,
        compactLabel: null,
        compactDisplay: null,
      };
    });
    mockPickBestModelSignals.mockReturnValue(
      new Map([
        [
          "model-1",
          {
            label: "Official launch",
            publishedAt: "2026-04-12T12:00:00.000Z",
          },
        ],
      ])
    );
  });

  it("renders skill rankings, summary cards, and surfaced access paths", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "benchmark_scores") {
          return createQueryResult([
            {
              score: 95,
              score_normalized: 95,
              model_id: "model-1",
              models: {
                id: "model-1",
                slug: "alpha-coder",
                name: "Alpha Coder",
                provider: "OpenAI",
                category: "llm",
                quality_score: 96,
                market_cap_estimate: 1200,
                is_open_weights: false,
              },
              benchmarks: { slug: "humaneval", name: "HumanEval" },
            },
            {
              score: 88,
              score_normalized: 88,
              model_id: "model-2",
              models: {
                id: "model-2",
                slug: "beta-open",
                name: "Beta Open",
                provider: "Meta",
                category: "llm",
                quality_score: 89,
                market_cap_estimate: 900,
                is_open_weights: true,
              },
              benchmarks: { slug: "swe-bench", name: "SWE-bench" },
            },
          ]);
        }

        if (table === "models") {
          return createQueryResult([
            {
              id: "model-1",
              slug: "alpha-coder",
              name: "Alpha Coder",
              provider: "OpenAI",
              category: "llm",
              capability_score: 95,
              quality_score: 96,
              economic_footprint_score: 92,
              market_cap_estimate: 1200,
              is_open_weights: false,
            },
            {
              id: "model-2",
              slug: "beta-open",
              name: "Beta Open",
              provider: "Meta",
              category: "llm",
              capability_score: 88,
              quality_score: 89,
              economic_footprint_score: 84,
              market_cap_estimate: 900,
              is_open_weights: true,
            },
          ]);
        }

        if (table === "model_news") {
          return createQueryResult([
            {
              id: "news-1",
              title: "Alpha launch",
              source: "provider-blog",
              related_provider: "OpenAI",
              related_model_ids: ["model-1"],
              published_at: "2026-04-12T12:00:00.000Z",
              metadata: {},
            },
          ]);
        }

        if (table === "model_pricing") {
          return createQueryResult([
            {
              model_id: "model-1",
              provider_name: "OpenAI",
              input_price_per_million: 5,
              output_price_per_million: 15,
            },
            {
              model_id: "model-2",
              provider_name: "Meta",
              input_price_per_million: 0,
              output_price_per_million: 0,
            },
          ]);
        }

        if (table === "deployment_platforms") {
          return createQueryResult([
            {
              id: "platform-1",
              slug: "runtime",
              name: "AI Market Runtime",
              type: "managed",
              base_url: "https://example.com/runtime",
              has_affiliate: false,
              affiliate_url_template: null,
              affiliate_url: null,
              affiliate_tag: null,
            },
          ]);
        }

        if (table === "model_deployments") {
          return createQueryResult([
            {
              id: "deployment-1",
              model_id: "model-1",
              platform_id: "platform-1",
              pricing_model: "metered",
              price_per_unit: 5,
              unit_description: "1M tokens",
              free_tier: null,
              one_click: true,
              status: "ready",
            },
          ]);
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const { default: SkillsPage } = await import("./page");
    render(await SkillsPage());

    expect(
      screen.getByRole("heading", { name: /Skills & Capabilities/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Discover which AI models are strongest at specific tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/Start with the skill cards below if you want the short answer/i)).toBeInTheDocument();
    expect(screen.getByText(/Skill signals refreshed 2026-04-12T12:00:00.000Z models \+ launches/i)).toBeInTheDocument();
    expect(screen.getAllByText("Coding & Development").length).toBeGreaterThan(0);
    expect(screen.getByText("Top Performer")).toBeInTheDocument();
    expect(screen.getAllByText("Alpha Coder").length).toBeGreaterThan(0);
    expect(screen.getByText(/Avg score 95.0 across 1 benchmark/i)).toBeInTheDocument();
    expect(screen.getByText("Best Budget Pick")).toBeInTheDocument();
    expect(screen.getAllByText("Beta Open").length).toBeGreaterThan(0);
    expect(screen.getByText(/Free access path · free tier/i)).toBeInTheDocument();
    expect(screen.getByText("Best Access Path")).toBeInTheDocument();
    expect(screen.getByText("AI Market Runtime")).toBeInTheDocument();
    expect(screen.getByText(/Open Guided Setup for Alpha Coder/i)).toBeInTheDocument();
    expect(screen.getByText("Open Weights Leader")).toBeInTheDocument();
    expect(screen.getByText(/Avg score 88.0 with public weights/i)).toBeInTheDocument();
    expect(screen.getByText("Official launch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Guided Setup/i })).toHaveAttribute(
      "href",
      "https://example.com/runtime"
    );
  });
});
