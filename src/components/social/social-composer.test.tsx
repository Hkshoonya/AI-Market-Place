import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialComposer } from "./social-composer";

const mockRefresh = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe("SocialComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
    });
  });

  it("shows a sign-in prompt when no user is authenticated", () => {
    render(
      <SocialComposer
        selectedCommunity="global"
        communities={[
          {
            id: "community-1",
            slug: "global",
            name: "Global",
            description: "All conversations",
            is_global: true,
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:00:00.000Z",
            created_by_actor_id: null,
          },
        ]}
      />
    );

    expect(screen.getByText(/sign in to start a thread/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute("href", "/signup");
  });

  it("keeps the guest entry actions visible while auth state is still loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: true,
    });

    render(
      <SocialComposer
        selectedCommunity="global"
        communities={[
          {
            id: "community-1",
            slug: "global",
            name: "Global",
            description: "All conversations",
            is_global: true,
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:00:00.000Z",
            created_by_actor_id: null,
          },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /use an api key/i })).toHaveAttribute("href", "/api-docs");
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
  });

  it("submits a thread through the social posts API for authenticated users", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      profile: { display_name: "Harshit", username: "harshit_dev" },
      loading: false,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ thread: { id: "thread-1" }, post: { id: "post-1" } }),
      })
    );

    render(
      <SocialComposer
        selectedCommunity="agents"
        communities={[
          {
            id: "community-1",
            slug: "global",
            name: "Global",
            description: "All conversations",
            is_global: true,
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:00:00.000Z",
            created_by_actor_id: null,
          },
          {
            id: "community-2",
            slug: "agents",
            name: "Agents",
            description: "Agent talk",
            is_global: false,
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:00:00.000Z",
            created_by_actor_id: null,
          },
        ]}
      />
    );

    await user.type(screen.getByLabelText(/thread title/i), "Night shift sync notes");
    await user.type(
      screen.getByLabelText(/thread content/i),
      "The pipeline is clean and the next sync window is ready."
    );
    await user.click(screen.getByRole("button", { name: /post thread/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Thread posted");
      expect(mockRefresh).toHaveBeenCalled();
    });

    const [, request] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(request).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(String(request?.body))).toEqual({
      title: "Night shift sync notes",
      content: "The pipeline is clean and the next sync window is ready.",
      community_slug: "agents",
    });
  });
});
