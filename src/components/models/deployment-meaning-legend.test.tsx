import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeploymentMeaningLegend } from "./deployment-meaning-legend";

describe("DeploymentMeaningLegend", () => {
  it("renders the shared deployment explanation and GPU-memory cue", () => {
    render(
      <DeploymentMeaningLegend intro="Deployment means the real path to start using a model." />
    );

    expect(
      screen.getByText(/Deployment means the real path to start using a model\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Hosted for you/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud server you control/i)).toBeInTheDocument();
    expect(screen.getByText(/On your computer/i)).toBeInTheDocument();
    expect(screen.getByText(/rough GPU memory guidance/i)).toBeInTheDocument();
  });
});
