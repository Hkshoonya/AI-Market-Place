import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./api-keys-content", () => ({
  default: () => <div>API keys content shell</div>,
}));

import ApiKeysPage, { metadata } from "./page";

describe("ApiKeysPage", () => {
  it("exports no-index API key metadata", () => {
    expect(metadata).toMatchObject({
      title: "API Keys",
      description: expect.stringContaining("API keys"),
      robots: { index: false, follow: false },
    });
  });

  it("renders the API keys content wrapper", () => {
    render(<ApiKeysPage />);

    expect(screen.getByText("API keys content shell")).toBeInTheDocument();
  });
});
