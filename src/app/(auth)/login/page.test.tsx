import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./login-form", () => ({
  default: ({
    initialRedirect,
    hasAuthError,
  }: {
    initialRedirect?: string;
    hasAuthError: boolean;
  }) => (
    <div>
      Login form redirect={initialRedirect ?? "none"} error={String(hasAuthError)}
    </div>
  ),
}));

import LoginPage, { metadata } from "./page";

describe("LoginPage", () => {
  it("exports sign-in metadata", () => {
    expect(metadata).toMatchObject({
      title: "Sign In",
      description: expect.stringContaining("Sign in"),
    });
  });

  it("passes redirect and auth error state into the login form", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          redirect: "/workspace",
          error: "oauth_failed",
        }),
      })
    );

    expect(
      screen.getByText("Login form redirect=/workspace error=true")
    ).toBeInTheDocument();
  });

  it("handles missing search params without crashing", async () => {
    render(await LoginPage({}));

    expect(screen.getByText("Login form redirect=none error=false")).toBeInTheDocument();
  });
});
