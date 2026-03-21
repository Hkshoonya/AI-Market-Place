import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSWR = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

import { RecentNotificationsCard } from "./recent-notifications-card";

describe("RecentNotificationsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders recent marketplace and order notifications with safe links", () => {
    mockUseSWR.mockReturnValue({
      data: {
        data: [
          {
            id: "notif-1",
            type: "marketplace",
            title: "New marketplace inquiry",
            message: "Buyer asked for onboarding details",
            link: "/marketplace/agent-protocol-kit",
            is_read: false,
            created_at: "2026-03-20T12:00:00.000Z",
          },
          {
            id: "notif-2",
            type: "order_update",
            title: "Order updated",
            message: "Seller shared delivery details",
            link: "/orders/order-1",
            is_read: true,
            created_at: "2026-03-20T11:00:00.000Z",
          },
        ],
        unreadCount: 1,
      },
      isLoading: false,
    });

    render(<RecentNotificationsCard />);

    expect(screen.getByText("Recent Notifications")).toBeInTheDocument();
    expect(screen.getByText("New marketplace inquiry")).toBeInTheDocument();
    expect(screen.getByText("Order updated")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open/i })[0]).toHaveAttribute(
      "href",
      "/marketplace/agent-protocol-kit"
    );
  });

  it("renders an empty state when there are no notifications", () => {
    mockUseSWR.mockReturnValue({
      data: { data: [], unreadCount: 0 },
      isLoading: false,
    });

    render(<RecentNotificationsCard />);

    expect(screen.getByText(/No notifications yet/i)).toBeInTheDocument();
    expect(screen.getByText(/seller inquiries, order updates, and system notes/i)).toBeInTheDocument();
  });
});
