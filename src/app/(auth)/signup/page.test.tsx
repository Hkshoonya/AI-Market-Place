import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./signup-form", () => ({
  default: ({
    initialRedirect,
  }: {
    initialRedirect?: string;
  }) => <div>Signup form shell redirect={initialRedirect ?? "none"}</div>,
}));

import SignupPage, { metadata } from "./page";

describe("SignupPage", () => {
  it("exports account-creation metadata", () => {
    expect(metadata).toMatchObject({
      title: "Create Account",
      description: expect.stringContaining("account"),
    });
  });

  it("passes redirect state into the signup form", async () => {
    render(
      await SignupPage({
        searchParams: Promise.resolve({
          redirect: "/commons",
        }),
      })
    );

    expect(
      screen.getByText("Signup form shell redirect=/commons")
    ).toBeInTheDocument();
  });

  it("handles missing search params without crashing", async () => {
    render(await SignupPage({}));

    expect(
      screen.getByText("Signup form shell redirect=none")
    ).toBeInTheDocument();
  });
});
