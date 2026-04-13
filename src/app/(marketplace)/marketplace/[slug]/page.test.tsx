import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn();
const mockCreatePublicClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockParseQueryResultSingle = vi.fn();
const mockAttachListingPolicies = vi.fn();
const mockEnrichListingWithProfile = vi.fn();
const mockBuildListingPreviewManifest = vi.fn();
const mockGetListingCommerceSignals = vi.fn();
const mockGetListingPillClasses = vi.fn();
const mockFormatCurrency = vi.fn();
const mockFormatDate = vi.fn();
const mockFormatNumber = vi.fn();

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    notFound: (...args: unknown[]) => mockNotFound(...args),
  };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }) => {
    const linkProps = { ...props };
    delete linkProps.prefetch;
    return (
      <a href={typeof href === "string" ? href : "#"} {...linkProps}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResultSingle: (...args: unknown[]) => mockParseQueryResultSingle(...args),
}));

vi.mock("@/lib/marketplace/policy-read", () => ({
  attachListingPolicies: (...args: unknown[]) => mockAttachListingPolicies(...args),
}));

vi.mock("@/lib/marketplace/enrich-listings", () => ({
  PROFILE_FIELDS_FULL: "id, display_name",
  enrichListingWithProfile: (...args: unknown[]) => mockEnrichListingWithProfile(...args),
}));

vi.mock("@/lib/marketplace/manifest", () => ({
  buildListingPreviewManifest: (...args: unknown[]) => mockBuildListingPreviewManifest(...args),
}));

vi.mock("@/lib/marketplace/presentation", () => ({
  getListingCommerceSignals: (...args: unknown[]) => mockGetListingCommerceSignals(...args),
  getListingPillClasses: (...args: unknown[]) => mockGetListingPillClasses(...args),
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: (...args: unknown[]) => mockFormatCurrency(...args),
  formatDate: (...args: unknown[]) => mockFormatDate(...args),
  formatNumber: (...args: unknown[]) => mockFormatNumber(...args),
}));

vi.mock("@/components/marketplace/seller-card", () => ({
  SellerCard: ({ seller }: { seller: { display_name: string | null } }) => (
    <div>Seller card {seller.display_name}</div>
  ),
}));

vi.mock("@/components/marketplace/listing-reviews", () => ({
  ListingReviews: ({ listingSlug }: { listingSlug: string }) => (
    <div>Reviews {listingSlug}</div>
  ),
}));

vi.mock("@/components/marketplace/contact-form", () => ({
  ContactForm: ({ listing }: { listing: { title: string } }) => (
    <div>Contact form {listing.title}</div>
  ),
}));

vi.mock("@/components/marketplace/view-tracker", () => ({
  ViewTracker: ({ listingId }: { listingId: string }) => <div>View tracker {listingId}</div>,
}));

vi.mock("@/components/marketplace/report-listing-button", () => ({
  ReportListingButton: ({ listingSlug }: { listingSlug: string }) => (
    <div>Report {listingSlug}</div>
  ),
}));

vi.mock("@/components/marketplace/purchase-button", () => ({
  PurchaseButton: ({ listingId }: { listingId: string }) => <div>Purchase {listingId}</div>,
}));

vi.mock("@/components/marketplace/manifest-preview-card", () => ({
  ManifestPreviewCard: ({ manifest }: { manifest: { id: string } }) => (
    <div>Manifest {manifest.id}</div>
  ),
}));

vi.mock("@/components/marketplace/settlement-policy-callout", () => ({
  SettlementPolicyCallout: () => <div>Settlement policy</div>,
}));

const baseListing = {
  id: "listing-1",
  slug: "agent-protocol-kit",
  seller_id: "seller-1",
  title: "Agent Protocol Kit",
  short_description: "Managed agent bundle with manifest-backed delivery.",
  description: "Long description for the agent protocol kit.",
  listing_type: "agent",
  pricing_type: "one_time",
  price: 49,
  currency: "USD",
  documentation_url: "https://example.com/docs",
  demo_url: "https://example.com/demo",
  tags: ["agent", "manifest"],
  agent_config: null,
  mcp_manifest: null,
  preview_manifest: { schema_version: "1.0" },
  view_count: 1234,
  created_at: "2026-04-10T00:00:00.000Z",
  avg_rating: 4.7,
  review_count: 12,
  profiles: {
    id: "seller-1",
    display_name: "Builder Labs",
    username: "builder",
    avatar_url: null,
    seller_bio: null,
    seller_website: null,
    seller_verified: true,
    seller_rating: 4.8,
    total_sales: 18,
    created_at: "2026-01-01T00:00:00.000Z",
  },
};

function createSingleQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe("ListingDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mockParseQueryResultSingle.mockImplementation((response: { data: unknown }) => response.data);
    mockAttachListingPolicies.mockImplementation(async (_client: unknown, listings: unknown[]) => listings);
    mockEnrichListingWithProfile.mockResolvedValue(baseListing);
    mockBuildListingPreviewManifest.mockReturnValue({ id: "listing-1" });
    mockGetListingCommerceSignals.mockReturnValue({
      purchase: {
        label: "Wallet checkout",
        description: "Buy directly with wallet credits.",
        tone: "positive",
      },
      autonomy: {
        label: "Agent-ready",
        description: "Works with autonomous buyer flows.",
        tone: "positive",
      },
      manifest: {
        label: "Manifest-backed",
        description: "Delivery details are attached up front.",
        tone: "positive",
      },
      seller: {
        label: "Human seller",
        description: "A verified human seller manages delivery.",
        tone: "neutral",
      },
    });
    mockGetListingPillClasses.mockReturnValue("pill");
    mockFormatCurrency.mockReturnValue("$49.00");
    mockFormatDate.mockReturnValue("Apr 10, 2026");
    mockFormatNumber.mockReturnValue("1,234");
    mockCreateAdminClient.mockReturnValue({ kind: "admin-client" });
  });

  it("builds metadata from listing meta fields", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() => createSingleQuery({
        title: "Agent Protocol Kit",
        short_description: "Managed agent bundle with manifest-backed delivery.",
        listing_type: "agent",
      })),
    });

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "agent-protocol-kit" }),
      })
    ).resolves.toMatchObject({
      title: "Agent Protocol Kit",
      description: "Managed agent bundle with manifest-backed delivery.",
      alternates: {
        canonical: expect.stringContaining("/marketplace/agent-protocol-kit"),
      },
    });
  });

  it("falls back to generic marketplace metadata when the listing is missing", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() => createSingleQuery(null)),
    });
    mockParseQueryResultSingle.mockReturnValue(null);

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "missing" }),
      })
    ).resolves.toMatchObject({
      title: "Marketplace Listing",
      description: expect.stringContaining("listing"),
    });
  });

  it("renders the main listing shell with checkout, commerce signals, and seller info", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() => createSingleQuery(baseListing)),
    });

    const { default: ListingDetailPage } = await import("./page");
    render(
      await ListingDetailPage({
        params: Promise.resolve({ slug: "agent-protocol-kit" }),
      })
    );

    expect(screen.getByRole("heading", { name: "Agent Protocol Kit" })).toBeInTheDocument();
    expect(screen.getByText("Managed agent bundle with manifest-backed delivery.")).toBeInTheDocument();
    expect(screen.getByText("$49.00")).toBeInTheDocument();
    expect(screen.getByText("Buy with wallet credits")).toBeInTheDocument();
    expect(screen.getByText(/Top up wallet credits in \$20, \$40, \$60, and \$100 packs/i)).toBeInTheDocument();
    expect(screen.getByText("Wallet checkout")).toBeInTheDocument();
    expect(screen.getByText("Agent-ready")).toBeInTheDocument();
    expect(screen.getByText("Manifest-backed")).toBeInTheDocument();
    expect(screen.getByText("Human seller")).toBeInTheDocument();
    expect(screen.getByText("Purchase listing-1")).toBeInTheDocument();
    expect(screen.getByText("Contact form Agent Protocol Kit")).toBeInTheDocument();
    expect(screen.getByText("Manifest listing-1")).toBeInTheDocument();
    expect(screen.getByText("Seller card Builder Labs")).toBeInTheDocument();
    expect(screen.getByText("Reviews agent-protocol-kit")).toBeInTheDocument();
    expect(screen.getByText("View tracker listing-1")).toBeInTheDocument();
    expect(screen.getByText("Settlement policy")).toBeInTheDocument();
    expect(screen.getByText("1,234 views")).toBeInTheDocument();
    expect(screen.getByText(/Listed Apr 10, 2026/i)).toBeInTheDocument();
    expect(screen.getByText("2 tags")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Wallet" })).toHaveAttribute("href", "/wallet");
    expect(screen.getByRole("link", { name: "View Orders" })).toHaveAttribute("href", "/orders");
  });

  it("calls notFound when the listing cannot be resolved", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() => createSingleQuery(null)),
    });
    mockParseQueryResultSingle.mockReturnValue(null);

    const { default: ListingDetailPage } = await import("./page");

    await expect(
      ListingDetailPage({
        params: Promise.resolve({ slug: "missing" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
