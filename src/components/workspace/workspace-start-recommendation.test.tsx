import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceStartRecommendation } from "./workspace-start-recommendation";

describe("WorkspaceStartRecommendation", () => {
  it("renders provider guidance and lets the launch budget be adjusted", async () => {
    const onSuggestedAmountChange = vi.fn();

    render(
      <WorkspaceStartRecommendation
        action="Open guided setup"
        provider="Replicate"
        suggestedAmount={25}
        suggestedPack="Starter Pack"
        suggestedPackSlug="starter"
        onSuggestedAmountChange={onSuggestedAmountChange}
      />
    );

    expect(screen.getByText("Suggested start")).toBeInTheDocument();
    expect(screen.getByText("Open guided setup")).toBeInTheDocument();
    expect(screen.getByText("via Replicate")).toBeInTheDocument();
    expect(screen.getByText("$25")).toBeInTheDocument();
    expect(screen.getByText("Starter Pack")).toBeInTheDocument();
    expect(
      screen.getByText(/Changing the starting budget updates the suggested wallet pack automatically\./i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "40" } });

    expect(onSuggestedAmountChange).toHaveBeenLastCalledWith(40);
  });

  it("hides the provider badge for AI Market Cap paths", () => {
    render(
      <WorkspaceStartRecommendation
        action="Open guided setup"
        provider="AI Market Cap runtime"
        suggestedAmount={null}
        suggestedPack={null}
      />
    );

    expect(screen.queryByText(/via AI Market Cap runtime/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No top-up suggested/i)).toBeInTheDocument();
  });
});
