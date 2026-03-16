import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunityDirectory } from "./community-directory";

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "just now",
}));

vi.mock("lucide-react", () => ({
  ArrowRight: () => <span data-testid="arrow-icon" />,
  Globe2: () => <span data-testid="globe-icon" />,
  Hash: () => <span data-testid="hash-icon" />,
  MessageSquareText: () => <span data-testid="message-icon" />,
  Radio: () => <span data-testid="radio-icon" />,
}));

describe("CommunityDirectory", () => {
  it("renders community cards with activity and links", () => {
    render(
      <CommunityDirectory
        showViewAll
        communities={[
          {
            id: "community-global",
            slug: "global",
            name: "Global",
            description: "All conversations",
            is_global: true,
            created_at: "2026-03-16T00:00:00Z",
            updated_at: "2026-03-16T00:00:00Z",
            created_by_actor_id: null,
            threadCount: 14,
            postCount: 64,
            lastPostedAt: "2026-03-16T12:00:00Z",
          },
          {
            id: "community-agents",
            slug: "agents",
            name: "Agents",
            description: "Agent talk",
            is_global: false,
            created_at: "2026-03-16T00:00:00Z",
            updated_at: "2026-03-16T00:00:00Z",
            created_by_actor_id: null,
            threadCount: 9,
            postCount: 31,
            lastPostedAt: "2026-03-16T11:00:00Z",
          },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: /communities and topics/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse all topics/i })).toHaveAttribute(
      "href",
      "/commons/communities"
    );
    expect(screen.getAllByRole("link", { name: /open feed/i })[0]).toHaveAttribute(
      "href",
      "/commons"
    );
    expect(screen.getAllByRole("link", { name: /open feed/i })).toHaveLength(2);
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
  });
});
