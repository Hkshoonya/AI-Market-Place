import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FAQPage, { metadata } from "./page";

describe("FAQPage", () => {
  it("exports faq metadata", () => {
    expect(metadata).toMatchObject({
      title: "FAQ",
      alternates: {
        canonical: expect.stringContaining("/faq"),
      },
    });
  });

  it("renders major faq sections and support call to action", () => {
    render(<FAQPage />);

    expect(
      screen.getByRole("heading", { name: /Frequently Asked Questions/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marketplace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "API & Integrations" })).toBeInTheDocument();
    expect(screen.getByText("What is AI Market Cap?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Us" })).toHaveAttribute(
      "href",
      "/contact"
    );
  });
});
