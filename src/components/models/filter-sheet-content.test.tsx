import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterSheetContent } from "./filter-sheet-content";

describe("FilterSheetContent", () => {
  it("shows the updated deployment guidance and sends the expected filter updates", async () => {
    const user = userEvent.setup();
    const updateParams = vi.fn();
    const onClearAll = vi.fn();

    render(
      <FilterSheetContent
        currentProvider=""
        currentParams=""
        currentLicense=""
        currentOpenOnly={false}
        currentDeployableOnly={false}
        currentManagedOnly={false}
        currentHasApi={false}
        updateParams={updateParams}
        onClearAll={onClearAll}
      />
    );

    expect(screen.getByRole("button", { name: "Ready to Use" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guided setup here" })).toBeInTheDocument();
    expect(
      screen.getByText(/`Ready to Use` includes all verified ways to start using a model\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /`Guided setup here` narrows the directory to models that can open directly into the AI Market Cap launch flow\./i
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ready to Use" }));
    expect(updateParams).toHaveBeenLastCalledWith({ deployable: "true", managed: null });

    await user.click(screen.getByRole("button", { name: "Guided setup here" }));
    expect(updateParams).toHaveBeenLastCalledWith({ managed: "true", deployable: null });

    await user.click(screen.getByRole("button", { name: "Clear All Filters" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
