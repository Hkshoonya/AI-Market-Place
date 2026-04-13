import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceStartButton } from "./workspace-start-button";

const mockOpenWorkspace = vi.fn();

vi.mock("./workspace-provider", () => ({
  useWorkspace: () => ({
    openWorkspace: mockOpenWorkspace,
  }),
}));

describe("WorkspaceStartButton", () => {
  it("opens workspace with the supplied launch payload", async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceStartButton
        label="Open Guided Setup"
        model="Gemma 4 27B"
        modelSlug="gemma-4-27b"
        provider="Google"
        action="Open guided setup"
        nextUrl="https://example.com/setup"
        autoStartDeployment
        sponsored={false}
        suggestedPackSlug="starter"
        suggestedPack="$25 Starter"
        suggestedAmount={25}
      />
    );

    await user.click(screen.getByRole("button", { name: /Open Guided Setup/i }));

    expect(mockOpenWorkspace).toHaveBeenCalledWith({
      model: "Gemma 4 27B",
      modelSlug: "gemma-4-27b",
      provider: "Google",
      action: "Open guided setup",
      nextUrl: "https://example.com/setup",
      autoStartDeployment: true,
      sponsored: false,
      suggestedPackSlug: "starter",
      suggestedPack: "$25 Starter",
      suggestedAmount: 25,
    });
  });
});
