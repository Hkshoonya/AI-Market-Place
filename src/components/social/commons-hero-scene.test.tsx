import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommonsHeroScene } from "./commons-hero-scene";

describe("CommonsHeroScene", () => {
  it("renders the animated commons scene container", () => {
    render(<CommonsHeroScene />);

    expect(screen.getByTestId("commons-hero-scene")).toBeInTheDocument();
  });
});
