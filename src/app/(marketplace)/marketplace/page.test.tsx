import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...props
  }: {
    href?: string;
    children?: ReactNode;
    prefetch?: boolean;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/marketplace/category-cards", () => ({
  CategoryCards: () => <div data-testid="category-cards" />,
}));

vi.mock("@/components/marketplace/listings-grid", () => ({
  ListingsGrid: () => <div data-testid="listings-grid" />,
}));

vi.mock("@/components/shared/data-freshness-badge", () => ({
  DataFreshnessBadge: () => <div data-testid="freshness-badge" />,
}));

vi.mock("@/components/marketplace/marketplace-hero-scene", () => ({
  MarketplaceHeroScene: () => <div data-testid="marketplace-hero-scene" />,
}));

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createOptionalAdminClient: vi.fn(() => null),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResult: vi.fn((_response: unknown, _schema: unknown, name: string) => {
    if (name === "MarketplaceFeatured") {
      return [
        {
          id: "listing-1",
          seller_id: "seller-1",
          title: "Agent Protocol Kit",
          slug: "agent-protocol-kit",
          listing_type: "agent",
          status: "active",
          updated_at: "2026-03-20T12:00:00.000Z",
        },
      ];
    }
    return [];
  }),
  parseQueryResultPartial: vi.fn(() => [
    {
      id: "listing-1",
      listing_type: "agent",
      preview_manifest: { schema_version: "1.0" },
      mcp_manifest: null,
      agent_config: null,
      agent_id: "agent-1",
      autonomy_mode: "autonomous_allowed",
      updated_at: "2026-03-20T12:00:00.000Z",
    },
  ]),
}));

vi.mock("@/lib/marketplace/enrich-listings", () => ({
  PROFILE_FIELDS_CARD: "id, display_name",
  enrichListingsWithProfiles: vi.fn(async (_client: unknown, listings: unknown[]) => listings),
}));

vi.mock("@/lib/marketplace/discovery", () => ({
  sortMarketplaceListings: vi.fn((listings: unknown[]) => listings),
}));

vi.mock("@/lib/marketplace/policy-read", () => ({
  attachListingPolicies: vi.fn(async (_client: unknown, listings: unknown[]) => listings),
}));

import { createPublicClient } from "@/lib/supabase/public-server";
import MarketplacePage from "./page";

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createPublicClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    } as never);

    const from = vi.fn((table: string) => {
      if (table === "marketplace_listings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.mocked(createPublicClient).mockReturnValue({ from } as never);
  });

  it("renders the new marketplace explanation hero and fee messaging", async () => {
    render(await MarketplacePage());

    expect(screen.getByRole("heading", { name: /ai marketplace/i })).toBeInTheDocument();
    expect(screen.getByText(/direct wallet deals/i)).toBeInTheDocument();
    expect(screen.getByText(/assisted escrow/i)).toBeInTheDocument();
    expect(screen.getByText(/what we track/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no platform fee/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("marketplace-hero-scene")).toBeInTheDocument();
  });
});
