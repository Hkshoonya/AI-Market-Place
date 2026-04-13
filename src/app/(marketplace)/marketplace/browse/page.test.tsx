import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockParseQueryResult = vi.fn();
const mockAttachListingPolicies = vi.fn();
const mockEnrichListingsWithProfiles = vi.fn();
const mockFilterMarketplaceListings = vi.fn();
const mockSortMarketplaceListings = vi.fn();
const mockPaginateMarketplaceListings = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResult: (...args: unknown[]) => mockParseQueryResult(...args),
}));

vi.mock("@/lib/marketplace/policy-read", () => ({
  attachListingPolicies: (...args: unknown[]) => mockAttachListingPolicies(...args),
}));

vi.mock("@/lib/marketplace/enrich-listings", () => ({
  enrichListingsWithProfiles: (...args: unknown[]) => mockEnrichListingsWithProfiles(...args),
}));

vi.mock("@/lib/marketplace/discovery", () => ({
  filterMarketplaceListings: (...args: unknown[]) => mockFilterMarketplaceListings(...args),
  sortMarketplaceListings: (...args: unknown[]) => mockSortMarketplaceListings(...args),
  paginateMarketplaceListings: (...args: unknown[]) => mockPaginateMarketplaceListings(...args),
}));

vi.mock("@/components/marketplace/filter-bar", () => ({
  MarketplaceFilterBar: ({ totalCount }: { totalCount: number }) => <div>Filter bar {totalCount}</div>,
}));

vi.mock("@/components/marketplace/listings-grid", () => ({
  ListingsGrid: ({ listings }: { listings: unknown[] }) => <div>Listings grid {listings.length}</div>,
}));

vi.mock("@/components/models/pagination", () => ({
  Pagination: ({
    totalCount,
    basePath,
  }: {
    totalCount: number;
    basePath: string;
  }) => <div>Pagination {totalCount} {basePath}</div>,
}));

const rawListings = [
  {
    id: "listing-1",
    slug: "agent-protocol-kit",
    listing_type: "agent",
    title: "Agent Protocol Kit",
    status: "active",
    seller_id: "seller-1",
  },
];

function createBrowseQuery(data: unknown[]) {
  const result = { data, error: null };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    textSearch: vi.fn(() => chain),
    not: vi.fn(() => chain),
    is: vi.fn(() => chain),
    or: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };

  return chain;
}

describe("BrowsePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue({ kind: "admin-client" });
    mockParseQueryResult.mockImplementation((response: { data: unknown }) => response.data);
    mockAttachListingPolicies.mockImplementation(async (_client: unknown, listings: unknown[]) => listings);
    mockEnrichListingsWithProfiles.mockImplementation(async (_client: unknown, listings: unknown[]) => listings);
    mockFilterMarketplaceListings.mockImplementation((listings: unknown[]) => listings);
    mockSortMarketplaceListings.mockImplementation((listings: unknown[]) => listings);
    mockPaginateMarketplaceListings.mockImplementation((listings: unknown[]) => listings);
  });

  it("builds no-index metadata for marketplace search results", async () => {
    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        searchParams: Promise.resolve({ q: "agent" }),
      })
    ).resolves.toMatchObject({
      title: 'Search: "agent" - Marketplace',
      robots: {
        index: false,
        follow: true,
      },
    });
  });

  it("builds filtered type metadata for listing categories", async () => {
    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        searchParams: Promise.resolve({ type: "agent" }),
      })
    ).resolves.toMatchObject({
      title: "AI Agents - AI Marketplace",
      description: expect.stringContaining("Autonomous AI agents"),
      robots: {
        index: false,
        follow: true,
      },
    });
  });

  it("renders the default marketplace browse shell and pagination", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() => createBrowseQuery(rawListings)),
    });
    const paginatedListings = Array.from({ length: 19 }, (_, index) => ({
      id: `listing-${index + 1}`,
      title: `Listing ${index + 1}`,
    }));
    mockFilterMarketplaceListings.mockReturnValue(paginatedListings);
    mockSortMarketplaceListings.mockReturnValue(paginatedListings);
    mockPaginateMarketplaceListings.mockReturnValue(paginatedListings.slice(0, 18));

    const { default: BrowsePage } = await import("./page");
    render(await BrowsePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Browse Marketplace" })).toBeInTheDocument();
    expect(screen.getByText(/Use the filters below to narrow the marketplace/i)).toBeInTheDocument();
    expect(screen.getByText(/Start with trust if you want the safest choices first/i)).toBeInTheDocument();
    expect(screen.getByText("Filter bar 19")).toBeInTheDocument();
    expect(screen.getByText("Listings grid 18")).toBeInTheDocument();
    expect(screen.getByText("Pagination 19 /marketplace/browse")).toBeInTheDocument();
  });

  it("renders search results copy and passes search filters into the discovery pipeline", async () => {
    const query = createBrowseQuery(rawListings);
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const { default: BrowsePage } = await import("./page");
    render(
      await BrowsePage({
        searchParams: Promise.resolve({
          q: "agent",
          seller: "agent",
          contract: "manifest",
          sort: "value",
        }),
      })
    );

    expect(screen.getByRole("heading", { name: 'Search: "agent"' })).toBeInTheDocument();
    expect(screen.getByText(/Search results include listings you can buy, deploy, or access right away/i)).toBeInTheDocument();
    expect(mockFilterMarketplaceListings).toHaveBeenCalledWith(rawListings, {
      autonomy: "",
      contract: "manifest",
      sellerId: "",
      sellerMode: "agent",
    });
    expect(mockSortMarketplaceListings).toHaveBeenCalledWith(rawListings, "value");
  });
});
