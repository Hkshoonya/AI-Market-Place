import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage, { metadata } from "./page";

describe("PrivacyPage", () => {
  it("exports privacy metadata", () => {
    expect(metadata).toMatchObject({
      title: "Privacy Policy",
      description: expect.stringContaining("privacy policy"),
    });
  });

  it("renders the privacy policy sections", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(/Last updated: February 27, 2026/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /1\. Information We Collect/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /3\. Data Sharing & Third-Party Services/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Railway/i).length).toBeGreaterThanOrEqual(1);
  });
});
