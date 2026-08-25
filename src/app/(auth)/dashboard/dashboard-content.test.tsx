import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardContent from "./dashboard-content";

const mockUseSWR = vi.fn();
vi.mock("swr", () => ({ default: (...args: unknown[]) => mockUseSWR(...args) }));

const overview = {
  account: {
    email: "user@example.com",
    displayName: "Ada",
    joinedAt: "2026-01-01T00:00:00.000Z",
    isSeller: false,
    sellerVerified: false,
  },
  progress: {
    trackedModels: 2,
    activeApiKeys: 1,
    providerConnections: 0,
    deployments: 0,
    readyDeployments: 0,
  },
  usage: {
    dataRequestsThisMonth: 12,
    lastDataRequestAt: null,
    marketplaceOrders: 0,
    sellerListings: 0,
  },
  plan: { slug: "free", status: "active", currentPeriodEnd: null },
  recentDeployments: [],
  warnings: [],
};

describe("DashboardContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue({
      data: overview,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it("turns account state into a concrete next action", () => {
    render(<DashboardContent />);

    expect(screen.getByRole("heading", { name: /welcome back, ada/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /connect a provider/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /connect provider/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 of 4 product milestones complete/i)).toBeInTheDocument();
  });

  it("describes the available products and pilot payment state honestly", () => {
    render(<DashboardContent />);

    expect(screen.getByRole("heading", { name: /model intelligence/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /data api/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /provider-connected runtime/i })).toBeInTheDocument();
    expect(screen.getByText(/paid data upgrades are currently handled as pilot access/i)).toBeInTheDocument();
    expect(screen.getAllByText(/explorer/i).length).toBeGreaterThan(0);
  });
});
