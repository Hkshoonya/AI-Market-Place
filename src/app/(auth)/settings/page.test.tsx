import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./settings-form", () => ({
  default: () => <div>Settings form shell</div>,
}));

import SettingsPage, { metadata } from "./page";

describe("SettingsPage", () => {
  it("exports account settings metadata", () => {
    expect(metadata).toMatchObject({
      title: "Account Settings",
      description: expect.stringContaining("settings"),
    });
  });

  it("renders the settings form wrapper", () => {
    render(<SettingsPage />);

    expect(screen.getByText("Settings form shell")).toBeInTheDocument();
  });
});
