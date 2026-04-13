import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ApiDocsPage, { metadata } from "./page";

vi.mock("./api-docs-content", () => ({
  ApiDocsContent: () => <div>ApiDocsContent</div>,
}));

describe("ApiDocsPage", () => {
  it("exports api docs metadata", () => {
    expect(metadata).toMatchObject({
      title: "API Documentation",
      alternates: {
        canonical: expect.stringContaining("/api-docs"),
      },
    });
  });

  it("renders the api docs content wrapper", () => {
    render(<ApiDocsPage />);

    expect(screen.getByText("ApiDocsContent")).toBeInTheDocument();
  });
});
