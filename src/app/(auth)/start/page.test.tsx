import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./start-content", () => ({
  default: () => <div>Start content shell</div>,
}));

import StartPage, { metadata } from "./page";

describe("StartPage", () => {
  it("exports no-index deployment start metadata", () => {
    expect(metadata).toMatchObject({
      title: "Start Deployment",
      description: expect.stringContaining("deploy"),
      robots: { index: false, follow: false },
    });
  });

  it("renders the start content wrapper", () => {
    render(<StartPage />);

    expect(screen.getByText("Start content shell")).toBeInTheDocument();
  });
});
