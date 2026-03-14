import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthButton } from "./auth-button";

const mockUseAuth = vi.fn();

vi.mock("./auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows both sign-in and sign-up links when unauthenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
    });

    render(<AuthButton />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/signup"
    );
  });
});
