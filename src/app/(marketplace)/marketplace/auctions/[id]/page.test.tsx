import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auction-detail-content", () => ({
  default: ({ auctionId }: { auctionId: string }) => (
    <div>Auction detail content {auctionId}</div>
  ),
}));

describe("AuctionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds metadata from the live auction payload when fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          listing: {
            title: "Claude Runtime Access",
            short_description: "Managed runtime access with immediate activation.",
          },
          auction_type: "english",
        }),
      }))
    );

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "auction-1" }),
      })
    ).resolves.toMatchObject({
      title: "Claude Runtime Access - Auction",
      description: "Managed runtime access with immediate activation.",
      openGraph: {
        title: "Claude Runtime Access - Auction | AI Market Cap",
      },
      alternates: {
        canonical: expect.stringContaining("/marketplace/auctions/auction-1"),
      },
    });
  });

  it("falls back to default metadata when the auction fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "missing-auction" }),
      })
    ).resolves.toMatchObject({
      title: "Auction Detail",
      description: expect.stringContaining("place your bid"),
      openGraph: {
        title: "Auction Detail | AI Market Cap",
      },
    });
  });

  it("passes the route id into the auction detail content", async () => {
    const { default: AuctionDetailPage } = await import("./page");

    render(
      await AuctionDetailPage({
        params: Promise.resolve({ id: "auction-99" }),
      })
    );

    expect(screen.getByText("Auction detail content auction-99")).toBeInTheDocument();
  });
});
