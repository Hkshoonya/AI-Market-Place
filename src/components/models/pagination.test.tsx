import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Pagination } from "./pagination";

const mockPush = vi.fn();
const mockUseRouter = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  useSearchParams: () => mockUseSearchParams(),
}));

describe("Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({ push: mockPush });
  });

  it("returns nothing when only one page exists", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
    const { container } = render(<Pagination totalCount={10} pageSize={10} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders pages and navigates while preserving query params", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(new URLSearchParams("q=gemma&page=4"));

    render(<Pagination totalCount={120} pageSize={10} basePath="/models" />);

    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 4" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("...")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Go to previous page" }));
    expect(mockPush).toHaveBeenLastCalledWith("/models?q=gemma&page=3", { scroll: true });

    await user.click(screen.getByRole("button", { name: "Page 1" }));
    expect(mockPush).toHaveBeenLastCalledWith("/models?q=gemma", { scroll: true });

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(mockPush).toHaveBeenLastCalledWith("/models?q=gemma&page=5", { scroll: true });
  });
});
