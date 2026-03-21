import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListPublishedRevenueReports = vi.fn();

vi.mock("@/lib/revenue/reporting", () => ({
  listPublishedRevenueReports: (...args: unknown[]) =>
    mockListPublishedRevenueReports(...args),
}));

describe("AboutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the public revenue formula and transparency reporting state", async () => {
    mockListPublishedRevenueReports.mockResolvedValue([
      {
        slug: "2026-03",
        title: "March 2026",
        filename: "2026-03.md",
      },
    ]);

    const { default: AboutPage } = await import("./page");
    render(await AboutPage());

    expect(screen.getByRole("heading", { name: /About AI Market Cap/i })).toBeInTheDocument();
    expect(screen.getByText(/Revenue transparency/i)).toBeInTheDocument();
    expect(screen.getByText(/50% Product Treasury/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /March 2026/i })).toHaveAttribute(
      "href",
      "https://github.com/AI-Market-Cap/AI-Market-Cap/blob/main/reports/revenue/2026-03.md"
    );
  });

  it("shows the reporting cadence when no revenue reports are published yet", async () => {
    mockListPublishedRevenueReports.mockResolvedValue([]);

    const { default: AboutPage } = await import("./page");
    render(await AboutPage());

    expect(screen.getByText(/The first monthly revenue report will be published here/i)).toBeInTheDocument();
  });
});
