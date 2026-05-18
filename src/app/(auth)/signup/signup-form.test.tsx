import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupForm from "./signup-form";

const mockSignInWithOAuth = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signUp: mockSignUp,
    },
  }),
}));

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
  });

  it("preserves the redirect target when linking back to sign-in", () => {
    render(<SignupForm initialRedirect="/commons" />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fcommons"
    );
  });

  it("passes the redirect target into email confirmation callbacks", async () => {
    render(<SignupForm initialRedirect="/commons" />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password, minimum 6 characters/i), {
      target: { value: "hunter2" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "hunter2" },
    });

    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }).closest("form")!
    );

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "hunter2",
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fcommons`,
        },
      });
    });

    expect(
      screen.getByRole("link", { name: "Back to Sign In" })
    ).toHaveAttribute("href", "/login?redirect=%2Fcommons");
  });

  it("passes the redirect target into OAuth sign-up callbacks", async () => {
    render(<SignupForm initialRedirect="/commons" />);

    fireEvent.click(screen.getByRole("button", { name: /continue with github/i }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Fcommons`,
        },
      });
    });
  });
});
