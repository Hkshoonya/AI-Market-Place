import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./profile-content", () => ({
  default: () => <div>Profile content shell</div>,
}));

import ProfilePage, { metadata } from "./page";

describe("ProfilePage", () => {
  it("exports profile metadata", () => {
    expect(metadata).toMatchObject({
      title: "My Profile",
      description: expect.stringContaining("profile"),
    });
  });

  it("renders the profile content wrapper", () => {
    render(<ProfilePage />);

    expect(screen.getByText("Profile content shell")).toBeInTheDocument();
  });
});
