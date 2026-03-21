import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminOverviewPage from "./page";

const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows recent marketplace inquiries when they are available", () => {
    mockUseSWR.mockImplementation((key: string) => {
      if (key === "supabase:admin-overview") {
        return {
          data: {
            totalModels: 10,
            activeModels: 8,
            totalUsers: 5,
            totalListings: 4,
            activeListings: 3,
            totalOrders: 2,
            totalViews: 0,
            totalDownloads: 50,
            recentModels: [],
            recentUsers: [],
          },
          isLoading: false,
          error: undefined,
          mutate: vi.fn(),
        };
      }

      if (key === "/api/admin/contact-submissions?limit=5") {
        return {
          data: {
            data: [
              {
                id: "sub-1",
                name: "Buyer",
                email: "buyer@example.com",
                subject: "Marketplace inquiry for Agent Protocol Kit",
                created_at: "2026-03-20T12:00:00.000Z",
                listingTitle: "Agent Protocol Kit",
                listingSlug: "agent-protocol-kit",
                link: "/marketplace/agent-protocol-kit",
              },
            ],
          },
          isLoading: false,
        };
      }

      return { data: undefined, isLoading: false, error: undefined, mutate: vi.fn() };
    });

    render(<AdminOverviewPage />);

    expect(screen.getByText(/recent marketplace inquiries/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Agent Protocol Kit/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open listing/i })).toHaveAttribute(
      "href",
      "/marketplace/agent-protocol-kit"
    );
  });

  it("shows an explicit error state instead of rendering nothing when loading fails", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });

    const { container } = render(<AdminOverviewPage />);

    expect(screen.getByText(/unable to load admin overview/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });
});
