import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelActions } from "./model-actions";

const mockPush = vi.fn();
const mockUseRouter = vi.fn();
const mockUseAuth = vi.fn();
const mockUseSWR = vi.fn();
const mockMutateBookmark = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/components/watchlists/add-to-watchlist", () => ({
  AddToWatchlist: ({ modelName }: { modelName: string }) => (
    <div>{`Watchlist:${modelName}`}</div>
  ),
}));

describe("ModelActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockUseSWR.mockReturnValue({ data: undefined, mutate: mockMutateBookmark });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("uses local bookmarks for signed-out users and routes compare to the model", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null });

    render(<ModelActions modelSlug="gemma-4-27b" modelName="Gemma 4 27B" />);

    await user.click(screen.getByRole("button", { name: "Bookmark" }));

    expect(localStorage.getItem("aimc_bookmarks")).toBe('["gemma-4-27b"]');
    expect(screen.getByRole("button", { name: "Bookmarked" })).toBeInTheDocument();
    expect(screen.getByText("Gemma 4 27B bookmarked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Compare" }));
    expect(mockPush).toHaveBeenCalledWith("/compare?models=gemma-4-27b");
  });

  it("persists bookmarks through the API for signed-in users", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    mockUseAuth.mockReturnValue({ user: { id: "user_123" } });
    mockUseSWR.mockReturnValue({ data: false, mutate: mockMutateBookmark });

    render(
      <ModelActions
        modelSlug="kimi-k2"
        modelName="Kimi K2"
        modelId="model_123"
      />
    );

    expect(screen.getByText("Watchlist:Kimi K2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bookmark" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: "model_123" }),
      });
    });
    expect(mockMutateBookmark).toHaveBeenCalled();
    expect(screen.getByText("Kimi K2 bookmarked")).toBeInTheDocument();
  });
});
