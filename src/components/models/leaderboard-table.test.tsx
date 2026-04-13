import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import LeaderboardTable, { ScoreBar } from "./leaderboard-table";

describe("ScoreBar", () => {
  it("renders a dash when the score is missing", () => {
    render(<ScoreBar value={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the numeric score when present", () => {
    render(<ScoreBar value={84.2} />);

    expect(screen.getByText("84.2")).toBeInTheDocument();
  });
});

describe("LeaderboardTable", () => {
  it("renders rows, sort indicators, and pagination controls", async () => {
    const user = userEvent.setup();
    const toggleSort = vi.fn();
    const previousPage = vi.fn();
    const nextPage = vi.fn();

    const table = {
      getHeaderGroups: () => [
        {
          id: "header-group-1",
          headers: [
            {
              id: "rank",
              getSize: () => 64,
              getContext: () => ({}),
              column: {
                columnDef: { header: "#" },
                getToggleSortingHandler: () => toggleSort,
                getIsSorted: () => "asc",
              },
            },
            {
              id: "model",
              getSize: () => 220,
              getContext: () => ({}),
              column: {
                columnDef: { header: "Model" },
                getToggleSortingHandler: () => undefined,
                getIsSorted: () => false,
              },
            },
          ],
        },
      ],
      getRowModel: () => ({
        rows: [
          {
            id: "row-1",
            getVisibleCells: () => [
              {
                id: "rank-cell",
                column: { getSize: () => 64, columnDef: { cell: "#1" } },
                getContext: () => ({}),
              },
              {
                id: "model-cell",
                column: { getSize: () => 220, columnDef: { cell: "Claude Opus 4.6" } },
                getContext: () => ({}),
              },
            ],
          },
        ],
      }),
      getPageCount: () => 3,
      getState: () => ({ pagination: { pageIndex: 1 } }),
      previousPage,
      nextPage,
      getCanPreviousPage: () => true,
      getCanNextPage: () => true,
    } as never;

    render(<LeaderboardTable table={table} />);

    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Claude Opus 4.6")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Prev/i }));
    expect(previousPage).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(nextPage).toHaveBeenCalled();

    await user.click(screen.getByText("#"));
    expect(toggleSort).toHaveBeenCalled();
  });
});
