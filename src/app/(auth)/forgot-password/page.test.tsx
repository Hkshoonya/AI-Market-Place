import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./forgot-password-form", () => ({
  default: () => <div>Forgot password form shell</div>,
}));

import ForgotPasswordPage, { metadata } from "./page";

describe("ForgotPasswordPage", () => {
  it("exports forgot-password metadata", () => {
    expect(metadata).toMatchObject({
      title: "Forgot Password",
      description: expect.stringContaining("Reset"),
    });
  });

  it("renders the forgot-password form wrapper", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText("Forgot password form shell")).toBeInTheDocument();
  });
});
