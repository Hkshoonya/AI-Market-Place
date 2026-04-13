import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChangelogTab } from "./changelog-tab";

describe("ChangelogTab", () => {
  it("renders recent updates with formatted dates and update types", () => {
    const expectedDate = new Date("2026-04-01T00:00:00.000Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    render(
      <ChangelogTab
        updates={[
          {
            title: "Context window expanded",
            description: "Provider doubled the supported prompt length.",
            update_type: "capability_update",
            published_at: "2026-04-01T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Recent Updates")).toBeInTheDocument();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    expect(screen.getByText("Context window expanded")).toBeInTheDocument();
    expect(screen.getByText("Provider doubled the supported prompt length.")).toBeInTheDocument();
    expect(screen.getByText("capability update")).toBeInTheDocument();
  });

  it("renders the empty state when there are no updates", () => {
    render(<ChangelogTab updates={[]} />);

    expect(screen.getByText("No updates recorded yet.")).toBeInTheDocument();
  });
});
