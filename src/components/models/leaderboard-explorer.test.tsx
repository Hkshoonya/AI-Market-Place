import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LeaderboardExplorer from "./leaderboard-explorer";

const mockPush = vi.fn();
const mockUseRouter = vi.fn();
const mockUsePathname = vi.fn();
const mockUseSearchParams = vi.fn();
const mockUseReactTable = vi.fn();
const mockLensSwitched = vi.fn();
const mockSearchPerformed = vi.fn();
const mockSortModelsForLens = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock("@tanstack/react-table", () => ({
  useReactTable: (...args: unknown[]) => mockUseReactTable(...args),
  getCoreRowModel: () => vi.fn(),
  getSortedRowModel: () => vi.fn(),
  getPaginationRowModel: () => vi.fn(),
  flexRender: (renderer: unknown) => renderer,
}));

vi.mock("./leaderboard-controls", () => ({
  __esModule: true,
  default: ({
    activeLens,
    setActiveLens,
    lifecycleFilter,
    setLifecycleFilter,
    setCategoryFilter,
    setSearchQuery,
    onLensSwitched,
    onSearchPerformed,
    modelCount,
  }: Record<string, (...args: unknown[]) => void> & { activeLens: string; lifecycleFilter: string; modelCount: number }) => (
    <div>
      <div>{`Controls:${activeLens}:${lifecycleFilter}:${modelCount}`}</div>
      <button
        type="button"
        onClick={() => {
          onLensSwitched("overall", "value");
          setActiveLens("value");
        }}
      >
        Switch Lens
      </button>
      <button type="button" onClick={() => setLifecycleFilter("all")}>
        Show All Lifecycles
      </button>
      <button type="button" onClick={() => setCategoryFilter("llm")}>
        Filter Category
      </button>
      <button
        type="button"
        onClick={() => {
          setSearchQuery("gemma");
          onSearchPerformed("gemma", 1);
        }}
      >
        Search Gemma
      </button>
    </div>
  ),
  LENS_TABS: [
    { value: "overall", label: "Overall" },
    { value: "value", label: "Value" },
  ],
}));

vi.mock("./ranking-weight-controls", () => ({
  __esModule: true,
  default: ({
    onSortedModels,
    models,
  }: {
    onSortedModels: (models: unknown[]) => void;
    models: unknown[];
  }) => (
    <button type="button" onClick={() => onSortedModels(models)}>
      Apply Weights
    </button>
  ),
}));

vi.mock("./leaderboard-table", () => ({
  __esModule: true,
  default: ({ table }: { table: { data?: unknown[] } }) => (
    <div>{`LeaderboardTable:${Array.isArray(table?.data) ? table.data.length : 0}`}</div>
  ),
  ScoreBar: ({ value }: { value: number | null }) => <span>{value ?? "—"}</span>,
}));

vi.mock("@/lib/posthog", () => ({
  analytics: {
    lensSwitched: (...args: unknown[]) => mockLensSwitched(...args),
    searchPerformed: (...args: unknown[]) => mockSearchPerformed(...args),
  },
}));

vi.mock("@/lib/models/leaderboard", () => ({
  getLeaderboardLensRank: () => 1,
  getLeaderboardLensScore: () => 95,
  sortModelsForLens: (...args: unknown[]) => mockSortModelsForLens(...args),
}));

vi.mock("@/lib/models/lifecycle", () => ({
  getLifecycleBadge: () => ({ rankedByDefault: true, label: "Active" }),
}));

vi.mock("@/lib/constants/categories", () => ({
  CATEGORY_MAP: {
    llm: { label: "LLM" },
  },
}));

describe("LeaderboardExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockUsePathname.mockReturnValue("/leaderboards");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("lens=overall"));
    mockSortModelsForLens.mockImplementation((models: unknown[]) => models);
    mockUseReactTable.mockImplementation(({ data }: { data: unknown[] }) => ({ data }));
  });

  it("wires control actions into router updates, analytics, and weighted sorting", async () => {
    const user = userEvent.setup();
    const models = [
      {
        name: "Gemma 4 27B",
        slug: "gemma-4-27b",
        provider: "Google",
        category: "llm",
        status: "active",
        overall_rank: 1,
        category_rank: 1,
        quality_score: 92,
        value_score: 88,
        is_open_weights: true,
        hf_downloads: 1000,
        popularity_score: 80,
        adoption_score: 75,
        adoption_rank: 1,
        agent_score: 81,
        agent_rank: 1,
        popularity_rank: 1,
        economic_footprint_score: 70,
        economic_footprint_rank: 1,
        market_cap_estimate: 1000000,
        capability_score: 85,
        capability_rank: 1,
        usage_score: 74,
        usage_rank: 1,
        expert_score: 79,
        expert_rank: 1,
        balanced_rank: 1,
      },
    ];

    render(
      <LeaderboardExplorer
        models={models as never}
        initialLens="overall"
        initialLifecycleFilter="active"
      />
    );

    expect(screen.getByText("Controls:overall:active:1")).toBeInTheDocument();
    expect(screen.getByText("LeaderboardTable:1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch Lens" }));
    expect(mockLensSwitched).toHaveBeenCalledWith("overall", "value");
    expect(mockPush).toHaveBeenLastCalledWith("/leaderboards?lens=value", { scroll: false });

    await user.click(screen.getByRole("button", { name: "Show All Lifecycles" }));
    expect(mockPush).toHaveBeenLastCalledWith("/leaderboards?lens=overall&lifecycle=all", { scroll: false });

    await user.click(screen.getByRole("button", { name: "Search Gemma" }));
    expect(mockSearchPerformed).toHaveBeenCalledWith("gemma", 1);

    await user.click(screen.getByRole("button", { name: "Apply Weights" }));
    expect(screen.getByText("LeaderboardTable:1")).toBeInTheDocument();
  });
});
