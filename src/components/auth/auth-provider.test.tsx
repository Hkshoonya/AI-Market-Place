import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: authMocks.getSession,
      getUser: authMocks.getUser,
      onAuthStateChange: authMocks.onAuthStateChange,
      signOut: authMocks.signOut,
    },
    from: authMocks.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: null,
            error: { message: "not found" },
          })),
        })),
      })),
    })),
  }),
}));

import { AuthProvider, useAuth } from "./auth-provider";

function AuthProbe() {
  const { loading, user } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? "user" : "none"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    authMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    authMocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: authMocks.unsubscribe,
        },
      },
    });
  });

  it("stops loading if initial auth lookup hangs", async () => {
    authMocks.getUser.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved
        })
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("hydrates from an existing browser session even if getUser is still pending", async () => {
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
            email: "user@example.com",
          },
        },
      },
    });
    authMocks.getUser.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved
        })
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("user").textContent).toBe("user");
  });

  it("restores the signed-in user from cached auth state while refresh auth checks are still pending", async () => {
    localStorage.setItem(
      "ai-market-cap.auth",
      JSON.stringify({
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      })
    );
    authMocks.getUser.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved
        })
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("user").textContent).toBe("user");
  });
});
