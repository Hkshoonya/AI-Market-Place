import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockBuildLaunchRadar = vi.fn();
const mockGroupNewsBySignal = vi.fn();
const mockSummarizeNewsSignals = vi.fn();
const mockBuildModelNewsEvidenceMap = vi.fn();
const mockFormatRelativeDate = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/news/presentation", () => ({
  buildLaunchRadar: (...args: unknown[]) => mockBuildLaunchRadar(...args),
  groupNewsBySignal: (...args: unknown[]) => mockGroupNewsBySignal(...args),
  summarizeNewsSignals: (...args: unknown[]) => mockSummarizeNewsSignals(...args),
}));

vi.mock("@/lib/news/evidence", () => ({
  buildModelNewsEvidenceMap: (...args: unknown[]) => mockBuildModelNewsEvidenceMap(...args),
}));

vi.mock("@/lib/format", () => ({
  formatRelativeDate: (...args: unknown[]) => mockFormatRelativeDate(...args),
}));

vi.mock("@/components/news/news-card", () => ({
  NewsCard: ({ item }: { item: { title?: string | null } }) => (
    <div data-testid="news-card">{item.title}</div>
  ),
  UpdateCard: ({ update }: { update: { title?: string | null } }) => (
    <div data-testid="update-card">{update.title}</div>
  ),
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/components/news/launch-radar", () => ({
  LaunchRadar: ({
    title,
    items,
  }: {
    title: string;
    items: Array<{ title: string }>;
  }) => <div>{title}: {items.map((item) => item.title).join(", ")}</div>,
}));

vi.mock("@/components/news/signal-summary", () => ({
  SignalSummary: ({
    buckets,
    emptyLabel,
  }: {
    buckets: Array<{ label: string; count: number }>;
    emptyLabel: string;
  }) => (
    <div>
      {buckets.length > 0
        ? buckets.map((bucket) => `${bucket.label}:${bucket.count}`).join(", ")
        : emptyLabel}
    </div>
  ),
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

function createQueryResult<T>(data: T, count?: number) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    not: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (value: { data: T; count?: number; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, count, error: null })),
  };

  return chain;
}

describe("NewsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildLaunchRadar.mockReturnValue([{ title: "Launch Watch" }]);
    mockSummarizeNewsSignals.mockReturnValue([{ label: "Launches", count: 4 }]);
    mockGroupNewsBySignal.mockReturnValue([
      {
        type: "launches",
        label: "Launches",
        items: [{ id: "signal-1", title: "Claude launch" }],
      },
    ]);
    mockBuildModelNewsEvidenceMap.mockReturnValue(new Map([["model-1", 4.2]]));
    mockFormatRelativeDate.mockReturnValue("2h ago");
  });

  it("renders the public news summary, tabs, provider groups, and linked models", async () => {
    const modelNewsResponses = [
      createQueryResult([
        {
          id: "tweet-1",
          title: "Claude on X",
          source: "x-twitter",
          category: "launch",
          related_provider: "Anthropic",
          related_model_ids: ["model-1"],
          metadata: {},
          published_at: "2026-04-12T11:00:00.000Z",
        },
      ]),
      createQueryResult([
        {
          id: "blog-1",
          title: "OpenAI blog",
          source: "provider-blog",
          category: "pricing",
          related_provider: "OpenAI",
          related_model_ids: ["model-1"],
          metadata: {},
          published_at: "2026-04-12T10:00:00.000Z",
        },
      ]),
      createQueryResult([
        {
          id: "deploy-1",
          title: "New runtime path",
          source: "provider-deployment-signals",
          category: "deployment",
          related_provider: "OpenAI",
          related_model_ids: ["model-1"],
          metadata: {},
          published_at: "2026-04-12T09:00:00.000Z",
        },
      ]),
      createQueryResult([
        {
          id: "paper-1",
          title: "New paper",
          source: "arxiv",
          category: "research",
          related_provider: "Anthropic",
          related_model_ids: ["model-1"],
          metadata: {},
          published_at: "2026-04-12T08:00:00.000Z",
        },
      ]),
      createQueryResult([
        {
          id: "bench-1",
          title: "Benchmark update",
          source: "artificial-analysis",
          category: "benchmark",
          related_provider: "OpenAI",
          related_model_ids: ["model-1"],
          metadata: {},
          published_at: "2026-04-12T07:00:00.000Z",
        },
      ]),
      createQueryResult(null, 5),
      createQueryResult([
        {
          id: "provider-item-1",
          title: "Provider-linked item",
          url: "https://example.com/provider",
          source: "provider-blog",
          related_provider: "OpenAI",
          published_at: "2026-04-12T06:00:00.000Z",
        },
      ]),
      createQueryResult([
        {
          related_model_ids: ["model-1"],
          source: "provider-blog",
          category: "launch",
          metadata: {},
        },
      ]),
    ];

    mockCreatePublicClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "model_updates") {
          return createQueryResult([
            {
              id: "update-1",
              title: "Claude 4.1 shipped",
              published_at: "2026-04-12T12:00:00.000Z",
              models: {
                slug: "claude-4-1",
                name: "Claude 4.1",
                provider: "Anthropic",
              },
            },
          ]);
        }

        if (table === "model_news") {
          const response = modelNewsResponses.shift();
          if (!response) {
            throw new Error("Unexpected extra model_news query");
          }
          return response;
        }

        if (table === "models") {
          return createQueryResult([
            {
              id: "model-1",
              slug: "claude-4-1",
              name: "Claude 4.1",
              provider: "Anthropic",
              quality_score: 91,
            },
          ]);
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const { default: NewsPage } = await import("./page");
    render(await NewsPage());

    expect(
      screen.getByRole("heading", { name: "News & Updates" })
    ).toBeInTheDocument();
    expect(screen.getByText("6 items")).toBeInTheDocument();
    expect(screen.getByText(/Start here for launches, deployability updates/i)).toBeInTheDocument();
    expect(screen.getByText(/News stream refreshed/i)).toBeInTheDocument();
    expect(screen.getByText("Launches:4")).toBeInTheDocument();
    expect(screen.getByText(/Signal Radar: Launch Watch/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Social (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Deployments (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Research (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Benchmarks (1)" })).toBeInTheDocument();

    expect(screen.getByText("Claude 4.1 shipped")).toBeInTheDocument();
    expect(screen.getByText("Claude on X")).toBeInTheDocument();
    expect(screen.getByText("OpenAI blog")).toBeInTheDocument();
    expect(screen.getByText("New runtime path")).toBeInTheDocument();
    expect(screen.getByText("New paper")).toBeInTheDocument();
    expect(screen.getByText("Benchmark update")).toBeInTheDocument();
    expect(mockBuildModelNewsEvidenceMap).toHaveBeenCalledWith([
      {
        related_model_ids: ["model-1"],
        source: "provider-blog",
        category: "launch",
        metadata: {},
      },
    ]);
  });
});
