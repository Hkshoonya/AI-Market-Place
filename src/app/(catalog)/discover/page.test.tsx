import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockParseQueryResult = vi.fn();
const mockSortWatchlistsForDiscovery = vi.fn();
const mockSanitizeFilterValue = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResult: (...args: unknown[]) => mockParseQueryResult(...args),
}));

vi.mock("@/lib/discover/watchlists", () => ({
  sortWatchlistsForDiscovery: (...args: unknown[]) =>
    mockSortWatchlistsForDiscovery(...args),
}));

vi.mock("@/lib/utils/sanitize", () => ({
  sanitizeFilterValue: (...args: unknown[]) => mockSanitizeFilterValue(...args),
}));

function createQueryResult<T>(data: T, count = Array.isArray(data) ? data.length : 0) {
  return {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: T; count: number; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, count, error: null })),
  };
}

describe("DiscoverPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeFilterValue.mockImplementation((value: string) => value.trim());
    mockSortWatchlistsForDiscovery.mockImplementation((watchlists: unknown[]) => watchlists);
    mockParseQueryResult.mockImplementation((response: { data: unknown }) => response.data);
  });

  it("renders public watchlists, creator details, and pagination controls", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "watchlists") {
          return {
            select: vi.fn(() =>
              createQueryResult(
                [
                  {
                    id: "wl-1",
                    name: "Browser Agents",
                    description: "Best browser-native models",
                    is_public: true,
                    created_at: "2026-04-01T00:00:00.000Z",
                    updated_at: "2026-04-10T00:00:00.000Z",
                    user_id: "user-1",
                    watchlist_items: [{ id: "item-1" }, { id: "item-2" }],
                  },
                ],
                30
              ),
            ),
          };
        }

        if (table === "profiles") {
          return {
            select: vi.fn(() =>
              createQueryResult([
                {
                  id: "user-1",
                  display_name: "Alex",
                  username: "alex",
                  avatar_url: null,
                },
              ]),
            ),
          };
        }

        return {
          select: vi.fn(() => createQueryResult([])),
        };
      }),
    });

    const { default: DiscoverPage } = await import("./page");

    render(
      await DiscoverPage({
        searchParams: Promise.resolve({ page: "1", q: "browser" }),
      }),
    );

    expect(screen.getByText("Discover Watchlists")).toBeInTheDocument();
    expect(screen.getByText(/Results for "browser"/i)).toBeInTheDocument();
    expect(screen.getByText("Browser Agents")).toBeInTheDocument();
    expect(screen.getByText("Best browser-native models")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("2 models")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/discover?page=2&q=browser",
    );
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("renders the empty state when no public watchlists match", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "watchlists") {
          return {
            select: vi.fn(() => createQueryResult([], 0)),
          };
        }

        return {
          select: vi.fn(() => createQueryResult([])),
        };
      }),
    });

    const { default: DiscoverPage } = await import("./page");

    render(
      await DiscoverPage({
        searchParams: Promise.resolve({ q: "missing" }),
      }),
    );

    expect(screen.getByText("No matching watchlists")).toBeInTheDocument();
    expect(screen.getByText("Try a different search term.")).toBeInTheDocument();
  });
});
