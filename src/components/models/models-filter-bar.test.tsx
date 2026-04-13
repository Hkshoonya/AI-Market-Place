import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ModelsFilterBar } from "./models-filter-bar";

const mockPush = vi.fn();
const mockUseRouter = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock("@/lib/constants/categories", () => ({
  CATEGORIES: [
    {
      slug: "llm",
      shortLabel: "LLM",
      icon: () => <svg data-testid="category-icon" />,
    },
  ],
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ModelsFilterBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
    });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("managed=true&sort=rank&view=list&lifecycle=all")
    );
  });

  it("shows managed-only results copy and updates filters through router pushes", async () => {
    const user = userEvent.setup();

    render(<ModelsFilterBar totalCount={24} />);

    expect(
      screen.getByText((_, element) => {
        return (
          element?.tagName.toLowerCase() === "p" &&
          element.textContent?.includes("Showing 24") &&
          element.textContent?.includes("models AI Market Cap can launch here")
        ) ?? false;
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guided setup here" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ready to Use" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /List view/i })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Ready to Use" }));
    expect(mockPush).toHaveBeenLastCalledWith("/models?sort=rank&view=list&lifecycle=all&deployable=true", { scroll: false });

    await user.click(screen.getByRole("button", { name: /Grid view/i }));
    expect(mockPush).toHaveBeenLastCalledWith("/models?managed=true&sort=rank&view=grid&lifecycle=all", { scroll: false });

    await user.click(screen.getByRole("button", { name: /Sort by Quality/i }));
    expect(mockPush).toHaveBeenLastCalledWith("/models?managed=true&sort=quality&view=list&lifecycle=all", { scroll: false });

    await user.click(screen.getByRole("button", { name: /Show active models only/i }));
    expect(mockPush).toHaveBeenLastCalledWith("/models?managed=true&sort=rank&view=list", { scroll: false });
  });
});
