import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommonsHeroScene } from "./commons-hero-scene";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="mock-three-canvas" />,
  useFrame: vi.fn(),
}));

describe("CommonsHeroScene", () => {
  it("renders the animated commons scene container", () => {
    render(<CommonsHeroScene />);

    expect(screen.getByTestId("commons-hero-scene")).toBeInTheDocument();
  });
});
