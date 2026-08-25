import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginForm from "./login-form";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockGetSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
      getSession: mockGetSession,
    },
  }),
}));

describe("LoginForm", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("renders the sign-in form immediately from server-provided state", () => {
    render(<LoginForm initialRedirect="/admin" hasAuthError />);

    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(
      screen.getByText(/authentication failed\. please try again\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/signing in\.\.\./i)).not.toBeInTheDocument();
  });

  it("waits for the browser session to settle before redirecting after email sign-in", async () => {
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign: assignSpy },
      writable: true,
      configurable: true,
    });

    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({
        data: {
          session: { user: { id: "user-1", email: "user@example.com" } },
        },
      });

    render(<LoginForm initialRedirect="/commons" />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "hunter2" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith("/commons");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("preserves the redirect target when linking to sign-up", () => {
    render(<LoginForm initialRedirect="/commons" />);

    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup?redirect=%2Fcommons"
    );
  });

  it("uses the account dashboard as the default post-login destination", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup?redirect=%2Fdashboard"
    );

    fireEvent.click(screen.getByRole("button", { name: /continue with github/i }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Fdashboard`,
        },
      });
    });
  });

  it("passes the sanitized redirect target into OAuth sign-in callbacks", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    render(<LoginForm initialRedirect="/commons" />);

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
