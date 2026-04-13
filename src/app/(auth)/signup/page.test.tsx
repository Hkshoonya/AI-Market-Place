import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./signup-form", () => ({
  default: () => <div>Signup form shell</div>,
}));

import SignupPage, { metadata } from "./page";

describe("SignupPage", () => {
  it("exports account-creation metadata", () => {
    expect(metadata).toMatchObject({
      title: "Create Account",
      description: expect.stringContaining("account"),
    });
  });

  it("renders the signup form wrapper", () => {
    render(<SignupPage />);

    expect(screen.getByText("Signup form shell")).toBeInTheDocument();
  });
});
