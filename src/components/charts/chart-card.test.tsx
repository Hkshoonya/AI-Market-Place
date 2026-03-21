import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChartCard } from "./chart-card";

describe("ChartCard", () => {
  it("labels the fullscreen control with the chart title", async () => {
    const user = userEvent.setup();

    render(
      <ChartCard title="Quality Chart" subtitle="Summary of quality signals">
        <div>chart body</div>
      </ChartCard>
    );

    const button = screen.getByRole("button", {
      name: "Open Quality Chart in fullscreen",
    });

    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(
      screen.getByRole("button", { name: "Exit fullscreen for Quality Chart" })
    ).toBeInTheDocument();
  });
});
