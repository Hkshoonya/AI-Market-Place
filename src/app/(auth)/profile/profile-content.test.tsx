import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileContent from "./profile-content";

const mockPush = vi.fn();
const mockUseAuth = vi.fn();
const mockUseSWR = vi.fn();
const updateEq = vi.fn();
const fromMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: fromMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("ProfileContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "user@example.com" },
      profile: {
        display_name: "User One",
        username: "userone",
        bio: "hello",
        avatar_url: null,
        is_admin: false,
        seller_verified: false,
        joined_at: "2026-03-01T00:00:00.000Z",
      },
      loading: false,
    });
    mockUseSWR.mockReturnValue({
      data: { bookmarks: [], watchlistCount: 0 },
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: (values: Record<string, unknown>) => ({
            eq: async (...args: unknown[]) => {
              await updateEq(values, ...args);
              return { error: null };
            },
          }),
        };
      }

      if (table === "user_bookmarks") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === "watchlists") {
        return {
          select: async () => ({ count: 0, error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("saves a selected custom avatar url with the profile update", async () => {
    const user = userEvent.setup();

    render(<ProfileContent />);

    await user.clear(screen.getByLabelText(/custom avatar url/i));
    await user.type(
      screen.getByLabelText(/custom avatar url/i),
      "https://images.example.com/custom-avatar.png"
    );
    await user.click(screen.getByRole("button", { name: /use url/i }));
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => {
      expect(updateEq).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar_url: "https://images.example.com/custom-avatar.png",
        }),
        "id",
        "user-1"
      );
    });

    expect(toastSuccess).toHaveBeenCalledWith("Profile updated successfully");
  });
});
