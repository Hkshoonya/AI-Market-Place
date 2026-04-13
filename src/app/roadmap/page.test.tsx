import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateOptionalAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createOptionalAdminClient: () => mockCreateOptionalAdminClient(),
}));

describe("RoadmapPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders shipped work, grouped roadmap items, and summary stats", async () => {
    mockCreateOptionalAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: "item-1",
                      slug: "stripe-webhook-recovery",
                      title: "Stripe webhook recovery",
                      area: "payments",
                      reason: "Payment delivery state must stay reliable.",
                      risk_level: "high",
                      required_before: "marketplace",
                      status: "planned",
                      updated_at: "2026-04-10T00:00:00.000Z",
                    },
                    {
                      id: "item-2",
                      slug: "workspace-deployment-polish",
                      title: "Workspace deployment polish",
                      area: "workspace",
                      reason: "Users still need clearer deployment flow.",
                      risk_level: "medium",
                      required_before: null,
                      status: "open",
                      updated_at: "2026-04-08T00:00:00.000Z",
                    },
                    {
                      id: "item-3",
                      slug: "search-confidence-badges",
                      title: "Search confidence badges",
                      area: "search",
                      reason: "Search results now distinguish benchmark-backed and signal-backed rows.",
                      risk_level: "low",
                      required_before: null,
                      status: "done",
                      updated_at: "2026-04-11T00:00:00.000Z",
                    },
                  ],
                })
              ),
            })),
          })),
        })),
      })),
    });

    const { default: RoadmapPage } = await import("./page");
    render(await RoadmapPage());

    expect(
      screen.getByRole("heading", { name: /What Is Live, What Ships Next/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Recently shipped")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live Now" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Next Up" })).toBeInTheDocument();
    expect(screen.getByText("Stripe webhook recovery")).toBeInTheDocument();
    expect(screen.getByText("Workspace deployment polish")).toBeInTheDocument();
    expect(screen.getByText("Search confidence badges")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByText(/High\s*risk/i)).toBeInTheDocument();
    expect(screen.getByText("Blocked by Marketplace")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getAllByText("Live now").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open Payments/i })).toHaveAttribute("href", "/wallet");
    expect(screen.getByRole("link", { name: /Open area/i })).toHaveAttribute("href", "/search");
  });

  it("renders the empty roadmap state when no items are available", async () => {
    mockCreateOptionalAdminClient.mockReturnValue(null);

    const { default: RoadmapPage } = await import("./page");
    render(await RoadmapPage());

    expect(screen.getByText("No open roadmap items")).toBeInTheDocument();
    expect(screen.getByText(/There are no public roadmap items to show right now/i)).toBeInTheDocument();
  });
});
