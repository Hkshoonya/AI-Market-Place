import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthButton } from "./auth-button";

const mockUseAuth = vi.fn();
const pushMock = vi.fn();
const refreshMock = vi.fn();
const pathnameMock = vi.fn();

vi.mock("./auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  usePathname: () => pathnameMock(),
}));

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathnameMock.mockReturnValue("/");
  });

  it("preserves the current route in sign-in and sign-up links when unauthenticated", () => {
    pathnameMock.mockReturnValue("/commons");
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
    });

    render(<AuthButton />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fcommons"
    );
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/signup?redirect=%2Fcommons"
    );
  });

  it("signs out and refreshes the app when the user clicks sign out", async () => {
    const user = userEvent.setup();
    const signOutMock = vi.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      user: { email: "admin@example.com" },
      profile: { display_name: "Admin", avatar_url: null },
      loading: false,
      signOut: signOutMock,
    });

    render(<AuthButton />);

    await user.click(screen.getByRole("button", { name: /user menu for admin/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
