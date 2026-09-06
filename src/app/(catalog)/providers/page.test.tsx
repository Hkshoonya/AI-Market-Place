import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockFormatNumber = vi.fn();
const mockDedupePublicModelFamilies = vi.fn();
const mockPickBestProviderSignals = vi.fn();
const mockPickBestModelSignals = vi.fn();
const mockBuildAccessOffersCatalog = vi.fn();
const mockGetBestAccessOfferForModel = vi.fn();
const mockGetDeployabilityLabel = vi.fn();
const mockIsSelfHostedDeployabilityLabel = vi.fn();
const mockSummarizeProviderSelfHostRequirements = vi.fn();
const mockPreferDefaultPublicSurfaceReady = vi.fn();

const cachedResults = vi.hoisted(() => new Map<string, string>());
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keys, args]);
      const cached = cachedResults.get(key);
      if (cached) return JSON.parse(cached);
      const result = await fn(...args);
      const serialized = JSON.stringify(result);
      cachedResults.set(key, serialized);
      return JSON.parse(serialized);
    },
}));

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/format", () => ({
  formatNumber: (...args: unknown[]) => mockFormatNumber(...args),
}));

vi.mock("@/lib/models/public-families", () => ({
  dedupePublicModelFamilies: (...args: unknown[]) => mockDedupePublicModelFamilies(...args),
}));

vi.mock("@/components/shared/provider-logo", () => ({
  ProviderLogo: ({ provider }: { provider: string }) => <div>{`Logo:${provider}`}</div>,
}));

vi.mock("@/components/charts/provider-charts", () => ({
  ProviderCharts: ({
    providers,
  }: {
    providers: Array<{ name: string }>;
  }) => <div>{`ProviderCharts:${providers.map((provider) => provider.name).join(",")}`}</div>,
}));

vi.mock("@/lib/news/provider-signals", () => ({
  pickBestProviderSignals: (...args: unknown[]) => mockPickBestProviderSignals(...args),
}));

vi.mock("@/lib/news/model-signals", () => ({
  pickBestModelSignals: (...args: unknown[]) => mockPickBestModelSignals(...args),
}));

vi.mock("@/components/news/provider-signal-badge", () => ({
  ProviderSignalBadge: ({ signal }: { signal: { title: string } }) => (
    <div>{`ProviderSignal:${signal.title}`}</div>
  ),
}));

vi.mock("@/components/shared/data-freshness-badge", () => ({
  DataFreshnessBadge: ({ label }: { label: string }) => <div>{`Freshness:${label}`}</div>,
}));

vi.mock("@/lib/providers/metrics", () => ({
  getCapabilityMetricValue: (model: { capability_score?: number | null }) => model.capability_score ?? null,
}));

vi.mock("@/lib/models/access-offers", () => ({
  buildAccessOffersCatalog: (...args: unknown[]) => mockBuildAccessOffersCatalog(...args),
  getBestAccessOfferForModel: (...args: unknown[]) => mockGetBestAccessOfferForModel(...args),
}));

vi.mock("@/lib/models/deployability", () => ({
  getDeployabilityLabel: (...args: unknown[]) => mockGetDeployabilityLabel(...args),
  isSelfHostedDeployabilityLabel: (...args: unknown[]) => mockIsSelfHostedDeployabilityLabel(...args),
}));

vi.mock("@/lib/models/self-host-requirements", () => ({
  summarizeProviderSelfHostRequirements: (...args: unknown[]) =>
    mockSummarizeProviderSelfHostRequirements(...args),
}));

vi.mock("@/lib/models/public-surface-readiness", () => ({
  preferDefaultPublicSurfaceReady: (...args: unknown[]) =>
    mockPreferDefaultPublicSurfaceReady(...args),
}));

function createQuery<T>(data: T, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: T; error: { message: string } | null }) => unknown) =>
      Promise.resolve(resolve({ data, error })),
  };
}

describe("ProvidersPage", () => {
  it("reuses serializable public summaries across different searches and pages", async () => {
    const { default: ProvidersPage } = await import("./page");
    const first = render(await ProvidersPage({ searchParams: Promise.resolve({ q: "OpenAI" }) }));
    expect(screen.getByText("ProviderSignal:OpenAI pricing update")).toBeInTheDocument();
    const queryCount = mockCreatePublicClient().from.mock.calls.length;
    first.unmount();
    render(await ProvidersPage({ searchParams: Promise.resolve({ q: "no-match", page: "2" }) }));
    expect(screen.getByText("No providers match your search.")).toBeInTheDocument();
    expect(mockDedupePublicModelFamilies).toHaveBeenCalledTimes(1);
    expect(mockCreatePublicClient().from).toHaveBeenCalledTimes(queryCount);
  });

  it("does not cache a partial directory when public signal queries fail", async () => {
    const db = mockCreatePublicClient();
    const originalFrom = db.from.getMockImplementation();
    db.from.mockImplementation((table: string) => table === "model_news"
      ? createQuery(null, { message: "temporary read failure" }) : originalFrom(table));
    const { default: ProvidersPage } = await import("./page");
    await expect(ProvidersPage()).rejects.toThrow("Unable to load public provider signals");
    db.from.mockImplementation(originalFrom);
    render(await ProvidersPage());
    expect(screen.getByText("ProviderSignal:OpenAI pricing update")).toBeInTheDocument();
  });

  it("paginates provider cards and preserves the search in navigation links", async () => {
    const db = mockCreatePublicClient();
    const originalFrom = db.from.getMockImplementation();
    db.from.mockImplementation((table: string) => table === "models"
      ? createQuery(Array.from({ length: 122 }, (_, index) => ({
          id: `model-${index}`, slug: `model-${index}`, name: `Model ${index}`,
          provider: `Provider ${Math.floor(index / 2)}`, overall_rank: index + 1,
          category: "llm", is_open_weights: false,
        })))
      : originalFrom(table));
    const { default: ProvidersPage } = await import("./page");
    render(await ProvidersPage({ searchParams: Promise.resolve({ q: "Provider", page: "2" }) }));
    const cards = screen.getAllByRole("link").filter((link) =>
      link.getAttribute("href")?.startsWith("/providers/")
    );
    expect(cards).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href", "/providers?page=1&q=Provider"
    );
    expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
  });

  it("filters provider cards without filtering the overall charts", async () => {
    const { default: ProvidersPage } = await import("./page");
    render(await ProvidersPage({ searchParams: Promise.resolve({ q: "no-such-provider", page: "invalid" }) }));
    expect(screen.getByText("No providers match your search.")).toBeInTheDocument();
    expect(screen.getByText("ProviderCharts:OpenAI")).toBeInTheDocument();
    expect(screen.getByLabelText("Search providers")).toHaveValue("no-such-provider");
    expect(screen.queryByRole("link", { name: /Logo:OpenAI/ })).not.toBeInTheDocument();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cachedResults.clear();
    mockFormatNumber.mockImplementation((value: number) => `${value}`);
    mockDedupePublicModelFamilies.mockImplementation((models: unknown[]) => models);
    mockPreferDefaultPublicSurfaceReady.mockImplementation((models: unknown[]) => models);
    mockPickBestModelSignals.mockReturnValue(new Map());
    mockPickBestProviderSignals.mockReturnValue(
      new Map([
        [
          "OpenAI",
          {
            title: "OpenAI pricing update",
            publishedAt: "2026-04-10T00:00:00.000Z",
          },
        ],
      ]),
    );
    mockBuildAccessOffersCatalog.mockReturnValue({ offers: true });
    mockGetBestAccessOfferForModel.mockReturnValue({
      monthlyPriceLabel: "$20/mo",
      actionLabel: "Open provider",
      platform: { name: "OpenAI Console" },
    });
    mockGetDeployabilityLabel.mockReturnValue("Managed");
    mockIsSelfHostedDeployabilityLabel.mockReturnValue(false);
    mockSummarizeProviderSelfHostRequirements.mockReturnValue({
      headline: "Works on 24GB GPU setups.",
    });

    mockCreatePublicClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "models") {
          return createQuery([
            {
              id: "model-1",
              slug: "gpt-alpha",
              name: "GPT Alpha",
              provider: "OpenAI",
              hf_downloads: 1000,
              capability_score: 95,
              quality_score: 94,
              economic_footprint_score: 90,
              overall_rank: 1,
              is_open_weights: false,
              category: "llm",
              parameter_count: null,
              context_window: 128000,
              modalities: ["text"],
            },
            {
              id: "model-2",
              slug: "gpt-beta",
              name: "GPT Beta",
              provider: "OpenAI",
              hf_downloads: 500,
              capability_score: 91,
              quality_score: 90,
              economic_footprint_score: 88,
              overall_rank: 3,
              is_open_weights: true,
              category: "multimodal",
              parameter_count: 1000000000,
              context_window: 128000,
              modalities: ["text", "image"],
            },
            {
              id: "model-3",
              slug: "claude-lite",
              name: "Claude Lite",
              provider: "Anthropic",
              hf_downloads: 250,
              capability_score: 84,
              quality_score: 83,
              economic_footprint_score: 80,
              overall_rank: 8,
              is_open_weights: false,
              category: "llm",
              parameter_count: null,
              context_window: 200000,
              modalities: ["text"],
            },
          ]);
        }

        if (table === "model_news") {
          return createQuery([
            {
              id: "news-1",
              title: "OpenAI pricing update",
              source: "Official",
              related_provider: "OpenAI",
              related_model_ids: ["model-1"],
              published_at: "2026-04-10T00:00:00.000Z",
              metadata: {},
            },
          ]);
        }

        if (table === "deployment_platforms") {
          return createQuery([
            {
              id: "platform-1",
              slug: "openai-console",
              name: "OpenAI Console",
              type: "managed_api",
              base_url: "https://example.com",
              has_affiliate: false,
              affiliate_url_template: null,
            },
          ]);
        }

        if (table === "model_deployments") {
          return createQuery([
            {
              id: "deploy-1",
              model_id: "model-1",
              platform_id: "platform-1",
              pricing_model: null,
              price_per_unit: null,
              unit_description: null,
              free_tier: null,
              one_click: true,
              status: "available",
            },
          ]);
        }

        return createQuery([]);
      }),
    });
  });

  it("renders provider stats, charts, and provider cards", async () => {
    const { default: ProvidersPage } = await import("./page");

    render(await ProvidersPage());

    expect(screen.getByText("AI Providers")).toBeInTheDocument();
    expect(screen.getByText("Freshness:Provider activity refreshed")).toBeInTheDocument();
    expect(screen.getByText("ProviderCharts:OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Logo:OpenAI")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OpenAI/i })).toHaveAttribute(
      "href",
      "/providers/openai",
    );
    expect(screen.getByText("2 deployable")).toBeInTheDocument();
    expect(screen.getByText("$20/mo")).toBeInTheDocument();
    expect(screen.getByText(/Open-weight reality:/i)).toBeInTheDocument();
    expect(screen.getByText("ProviderSignal:OpenAI pricing update")).toBeInTheDocument();
  });

  it("counts single-model providers in global totals even though their cards are filtered", async () => {
    const { default: ProvidersPage } = await import("./page");
    render(await ProvidersPage({ searchParams: Promise.resolve({ q: "OpenAI" }) }));
    const statValue = (label: string) => screen.getByText(label).previousElementSibling?.textContent;
    expect(statValue("Providers")).toBe("2");
    expect(statValue("Total Models")).toBe("3");
    expect(statValue("Open Weight Models")).toBe("1");
    expect(statValue("Total Downloads")).toBe("1750");
    expect(statValue("Deployable Models")).toBe("3");
    expect(screen.queryByRole("link", { name: /Logo:Anthropic/ })).not.toBeInTheDocument();
  });
});
