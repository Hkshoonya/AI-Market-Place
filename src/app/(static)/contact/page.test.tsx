import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ContactPage, { metadata } from "./page";

vi.mock("./contact-content", () => ({
  default: () => <div>ContactContent</div>,
}));

describe("ContactPage", () => {
  it("exports contact metadata", () => {
    expect(metadata).toMatchObject({
      title: "Contact Us",
      alternates: {
        canonical: expect.stringContaining("/contact"),
      },
    });
  });

  it("renders the contact content wrapper", () => {
    render(<ContactPage />);

    expect(screen.getByText("ContactContent")).toBeInTheDocument();
  });
});
