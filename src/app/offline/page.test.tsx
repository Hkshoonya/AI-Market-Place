import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OfflinePage, { metadata } from "./page";

describe("OfflinePage", () => {
  it("exports offline metadata", () => {
    expect(metadata).toMatchObject({
      title: "Offline",
      description: expect.stringContaining("offline"),
    });
  });

  it("renders the offline fallback copy", () => {
    render(<OfflinePage />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /You are offline right now/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reconnect and refresh to load live rankings/i)
    ).toBeInTheDocument();
  });
});
