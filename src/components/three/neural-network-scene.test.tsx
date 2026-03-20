import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NeuralNetworkScene } from "./neural-network-scene";

describe("NeuralNetworkScene", () => {
  it("renders the immersive neural network scene container", () => {
    render(<NeuralNetworkScene />);

    expect(screen.getByTestId("neural-network-scene")).toBeInTheDocument();
  });
});
