import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockPickBestModelSignals = vi.fn();
const mockBuildAccessOffersCatalog = vi.fn();
const mockGetBestAccessOfferForModel = vi.fn();
const mockPreferDefaultPublicSurfaceReady = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/news/model-signals", () => ({
  pickBestModelSignals: (...args: unknown[]) => mockPickBestModelSignals(...args),
}));

vi.mock("@/lib/models/access-offers", () => ({
  buildAccessOffersCatalog: (...args: unknown[]) => mockBuildAccessOffersCatalog(...args),
  getBestAccessOfferForModel: (...args: unknown[]) => mockGetBestAccessOfferForModel(...args),
}));

vi.mock("@/lib/models/public-surface-readiness", () => ({
  preferDefaultPublicSurfaceReady: (...args: unknown[]) =>
    mockPreferDefaultPublicSurfaceReady(...args),
}));

vi.mock("./compare-client", () => ({
  CompareClient: ({
    allModels,
    initialModels,
    initialSlugs,
  }: {
    allModels: Array<{ slug: string }>;
    initialModels: Array<{ slug: string }>;
    initialSlugs: string[];
  }) => (
    <div>
      <div>{`AllModels:${allModels.map((model) => model.slug).join(",")}`}</div>
      <div>{`InitialModels:${initialModels.map((model) => model.slug).join(",")}`}</div>
      <div>{`InitialSlugs:${initialSlugs.join(",")}`}</div>
    </div>
  ),
}));

function createQuery<T>(data: T) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: T; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };
}

describe("ComparePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPreferDefaultPublicSurfaceReady.mockImplementation((models: unknown[]) => models);
    mockPickBestModelSignals.mockReturnValue(new Map([["model-1", { title: "Signal" }]]));
    mockBuildAccessOffersCatalog.mockReturnValue({ catalog: true });
    mockGetBestAccessOfferForModel.mockReturnValue({
      monthlyPriceLabel: "$20/mo",
      actionLabel: "Open provider",
    });

    mockCreatePublicClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "models") {
          return {
            select: vi.fn((columns: string) => {
              if (columns === "name") {
                return createQuery([{ name: "Alpha" }, { name: "Beta" }]);
              }

              if (columns.includes("id, slug, name, provider, category")) {
                return createQuery([
                  {
                    id: "model-1",
                    slug: "alpha",
                    name: "Alpha",
                    provider: "OpenAI",
                    category: "llm",
                  },
                  {
                    id: "model-2",
                    slug: "beta",
                    name: "Beta",
                    provider: "Anthropic",
                    category: "multimodal",
                  },
                ]);
              }

              return createQuery([
                {
                  id: "model-1",
                  slug: "alpha",
                  name: "Alpha",
                  provider: "OpenAI",
                  category: "llm",
                  quality_score: 95,
                  capability_score: 96,
                  adoption_score: 90,
                  economic_footprint_score: 91,
                  benchmark_scores: [],
                  model_pricing: [],
                  elo_ratings: [],
                  rankings: [],
                },
                {
                  id: "model-2",
                  slug: "beta",
                  name: "Beta",
                  provider: "Anthropic",
                  category: "multimodal",
                  quality_score: 88,
                  capability_score: 90,
                  adoption_score: 80,
                  economic_footprint_score: 82,
                  benchmark_scores: [],
                  model_pricing: [],
                  elo_ratings: [],
                  rankings: [],
                },
              ]);
            }),
          };
        }

        if (table === "model_news") {
          return {
            select: vi.fn(() =>
              createQuery([
                {
                  id: "news-1",
                  title: "Alpha update",
                  source: "Official",
                  related_provider: "OpenAI",
                  related_model_ids: ["model-1"],
                  published_at: "2026-04-01T00:00:00.000Z",
                  metadata: {},
                },
              ])
            ),
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

        return {
          select: vi.fn(() => createQuery([])),
        };
      }),
    });
  });

  it("builds default compare metadata when no models are selected", async () => {
    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({ searchParams: Promise.resolve({}) })
    ).resolves.toMatchObject({
      title: "Compare AI Models",
      alternates: {
        canonical: expect.stringContaining("/compare"),
      },
    });
  });

  it("builds selected compare metadata from model names", async () => {
    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        searchParams: Promise.resolve({ models: "alpha,beta" }),
      })
    ).resolves.toMatchObject({
      title: "Compare Alpha vs Beta",
      robots: {
        index: false,
        follow: true,
      },
    });
  });

  it("loads selector and selected model data for the compare client", async () => {
    const { default: ComparePage } = await import("./page");

    render(
      await ComparePage({
        searchParams: Promise.resolve({ models: "alpha,beta" }),
      })
    );

    expect(screen.getByText("AllModels:alpha,beta")).toBeInTheDocument();
    expect(screen.getByText("InitialModels:alpha,beta")).toBeInTheDocument();
    expect(screen.getByText("InitialSlugs:alpha,beta")).toBeInTheDocument();
    expect(mockPreferDefaultPublicSurfaceReady).toHaveBeenCalled();
    expect(mockBuildAccessOffersCatalog).toHaveBeenCalled();
    expect(mockGetBestAccessOfferForModel).toHaveBeenCalledTimes(2);
  });
});
