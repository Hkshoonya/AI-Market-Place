import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TopMovers from "./top-movers";

vi.mock("swr", () => ({
  default: vi.fn(),
}));

import useSWR from "swr";

const mockedUseSWR = vi.mocked(useSWR);

describe("TopMovers", () => {
  it("exposes accessible tab state and a text summary for screen readers", async () => {
    const user = userEvent.setup();
    mockedUseSWR.mockReturnValue({
      data: {
        asOf: "2026-03-21T12:00:00.000Z",
        risers: [
          {
            name: "Model One",
            slug: "model-one",
            provider: "OpenAI",
            category: "llm",
            rankChange: 3,
            scoreChange: 1.2,
            currentRank: 2,
            currentScore: 88,
          },
        ],
        fallers: [
          {
            name: "Model Two",
            slug: "model-two",
            provider: "Anthropic",
            category: "llm",
            rankChange: -4,
            scoreChange: -2.4,
            currentRank: 9,
            currentScore: 76,
          },
        ],
      },
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useSWR>);

    render(<TopMovers />);

    expect(
      screen.getByRole("button", { name: "Show rising models" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(/Model One by OpenAI, current rank 2/i).closest(".sr-only")
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Show falling models" }));

    expect(
      screen.getByRole("button", { name: "Show falling models" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(/Model Two by Anthropic, current rank 9/i).closest(".sr-only")
    ).not.toBeNull();
  });
});
