import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./activity-content", () => ({
  default: () => <div>Activity content shell</div>,
}));

import ActivityPage, { metadata } from "./page";

describe("ActivityPage", () => {
  it("exports activity metadata", () => {
    expect(metadata).toMatchObject({
      title: "Activity",
      description: expect.stringContaining("recent activity"),
    });
  });

  it("renders the activity content wrapper", () => {
    render(<ActivityPage />);

    expect(screen.getByText("Activity content shell")).toBeInTheDocument();
  });
});
