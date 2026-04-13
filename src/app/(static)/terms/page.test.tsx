import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TermsPage, { metadata } from "./page";

describe("TermsPage", () => {
  it("exports terms metadata", () => {
    expect(metadata).toMatchObject({
      title: "Terms of Service",
      description: expect.stringContaining("terms of service"),
    });
  });

  it("renders the terms sections and dispute email", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText(/Last updated: February 27, 2026/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /1\. Acceptance of Terms/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /4\. Marketplace Terms/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "support@aimarketcap.tech" })[0]
    ).toHaveAttribute("href", "mailto:support@aimarketcap.tech");
  });
});
