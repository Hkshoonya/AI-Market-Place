import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NeuralNetworkScene } from "./neural-network-scene";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="mock-three-canvas" />,
}));

describe("NeuralNetworkScene", () => {
  it("renders the immersive neural network scene container", () => {
    render(<NeuralNetworkScene />);

    expect(screen.getByTestId("neural-network-scene")).toBeInTheDocument();
  });
});
