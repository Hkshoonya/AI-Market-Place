import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
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

vi.mock("@/lib/client-log", () => ({
  clientWarn: vi.fn(),
  clientError: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: authMocks.getSession,
      refreshSession: authMocks.refreshSession,
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
  const { loading, user, profile, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? "user" : "none"}</span>
      <span data-testid="profile">{profile ? "profile" : "none"}</span>
      <button type="button" onClick={() => signOut()}>
        Sign out
      </button>
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
    authMocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
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

  it("keeps cached auth provisional until Supabase restores a real session", async () => {
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

    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("user");

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("clears cached auth after timeout when Supabase cannot restore a real session", async () => {
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

    expect(screen.getByTestId("user").textContent).toBe("user");
    expect(screen.getByTestId("loading").textContent).toBe("true");

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(localStorage.getItem("ai-market-cap.auth")).toBeNull();
  });

  it("recovers a cached user by refreshing the real Supabase session", async () => {
    localStorage.setItem(
      "ai-market-cap.auth",
      JSON.stringify({
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      })
    );
    authMocks.refreshSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
            email: "user@example.com",
          },
        },
      },
      error: null,
    });
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(authMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user").textContent).toBe("user");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("does not stay stuck loading when INITIAL_SESSION profile hydration stalls", async () => {
    authMocks.getSession.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved
        })
    );
    authMocks.onAuthStateChange.mockImplementation((callback) => {
      void callback("INITIAL_SESSION", {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      });

      return {
        data: {
          subscription: {
            unsubscribe: authMocks.unsubscribe,
          },
        },
      };
    });
    authMocks.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(
            () =>
              new Promise(() => {
                // Intentionally unresolved
              })
          ),
        })),
      })),
    }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("user");

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("user");
  });

  it("keeps a valid session user signed in even if profile hydration stalls during initialization", async () => {
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
    authMocks.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(
            () =>
              new Promise(() => {
                // Intentionally unresolved
              })
          ),
        })),
      })),
    }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("true");
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("user").textContent).toBe("user");

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("user");
  });

  it("retries profile hydration when getUser confirms the same refreshed user", async () => {
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
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
    });
    authMocks.from.mockImplementationOnce(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: null,
            error: { message: "temporary failure" },
          })),
        })),
      })),
    }));
    authMocks.from.mockImplementationOnce(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              id: "user-1",
              username: "admin",
              display_name: "Admin",
              avatar_url: null,
              bio: null,
              is_admin: true,
              is_seller: false,
              seller_verified: false,
              joined_at: null,
            },
            error: null,
          })),
        })),
      })),
    }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("user").textContent).toBe("user");
    expect(screen.getByTestId("profile").textContent).toBe("profile");
  });

  it("clears local auth state even if Supabase sign-out fails", async () => {
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
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
    });
    authMocks.signOut.mockRejectedValue(new Error("missing session"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    await act(async () => {
      screen.getByRole("button", { name: /sign out/i }).click();
    });

    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(localStorage.getItem("ai-market-cap.auth")).toBeNull();
  });
});
