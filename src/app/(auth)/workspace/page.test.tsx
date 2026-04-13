import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./workspace-content", () => ({
  default: () => <div>Workspace content shell</div>,
}));

import WorkspacePage, { metadata } from "./page";

describe("WorkspacePage", () => {
  it("exports no-index workspace metadata", () => {
    expect(metadata).toMatchObject({
      title: "Workspace",
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
    });
  });

  it("renders the workspace content wrapper", () => {
    render(<WorkspacePage />);

    expect(screen.getByText("Workspace content shell")).toBeInTheDocument();
  });
});
