import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./reset-password-form", () => ({
  default: () => <div>Reset password form shell</div>,
}));

import ResetPasswordPage, { metadata } from "./page";

describe("ResetPasswordPage", () => {
  it("exports reset-password metadata", () => {
    expect(metadata).toMatchObject({
      title: "Reset Password",
      description: expect.stringContaining("new password"),
    });
  });

  it("renders the reset-password form wrapper", () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText("Reset password form shell")).toBeInTheDocument();
  });
});
