import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LeaderboardControls from "./leaderboard-controls";

describe("LeaderboardControls", () => {
  it("renders canonical public category labels", () => {
    render(
      <LeaderboardControls
        activeLens="capability"
        setActiveLens={vi.fn()}
        lifecycleFilter="active"
        setLifecycleFilter={vi.fn()}
        categoryFilter=""
        setCategoryFilter={vi.fn()}
        searchQuery=""
        setSearchQuery={vi.fn()}
        modelCount={1200}
        onLensSwitched={vi.fn()}
        onSearchPerformed={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Browser Agents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Embeddings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speech & Audio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capability" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Popularity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adoption" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Economic Footprint" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Value" })).toBeInTheDocument();
  });

  it("emits the canonical browser-agent category key", () => {
    const setCategoryFilter = vi.fn();

    render(
      <LeaderboardControls
        activeLens="capability"
        setActiveLens={vi.fn()}
        lifecycleFilter="active"
        setLifecycleFilter={vi.fn()}
        categoryFilter=""
        setCategoryFilter={setCategoryFilter}
        searchQuery=""
        setSearchQuery={vi.fn()}
        modelCount={1200}
        onLensSwitched={vi.fn()}
        onSearchPerformed={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browser Agents" }));

    expect(setCategoryFilter).toHaveBeenCalledWith("agentic_browser");
  });

  it("lets the user include tracked non-active models with one click", () => {
    const setLifecycleFilter = vi.fn();

    render(
      <LeaderboardControls
        activeLens="capability"
        setActiveLens={vi.fn()}
        lifecycleFilter="active"
        setLifecycleFilter={setLifecycleFilter}
        categoryFilter=""
        setCategoryFilter={vi.fn()}
        searchQuery=""
        setSearchQuery={vi.fn()}
        modelCount={1200}
        onLensSwitched={vi.fn()}
        onSearchPerformed={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Include Non-Active/i }));

    expect(setLifecycleFilter).toHaveBeenCalledWith("all");
  });
});
