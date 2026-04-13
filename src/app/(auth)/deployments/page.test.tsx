import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./deployments-content", () => ({
  default: () => <div>Deployments content shell</div>,
}));

import DeploymentsPage, { metadata } from "./page";

describe("DeploymentsPage", () => {
  it("exports deployments metadata", () => {
    expect(metadata).toMatchObject({
      title: "Deployments",
    });
  });

  it("renders the deployments content wrapper", () => {
    render(<DeploymentsPage />);

    expect(screen.getByText("Deployments content shell")).toBeInTheDocument();
  });
});
