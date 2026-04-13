import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./edit-listing-content", () => ({
  default: ({
    params,
  }: {
    params: Promise<{ slug: string }>;
  }) => <div>Edit listing shell {String(params instanceof Promise)}</div>,
}));

import EditListingPage, { metadata } from "./page";

describe("EditListingPage", () => {
  it("exports edit-listing metadata", () => {
    expect(metadata).toMatchObject({
      title: "Edit Listing",
      description: expect.stringContaining("marketplace listing"),
    });
  });

  it("passes params through to the edit listing content", () => {
    render(<EditListingPage params={Promise.resolve({ slug: "listing-1" })} />);

    expect(screen.getByText("Edit listing shell true")).toBeInTheDocument();
  });
});
