import type { Metadata } from "next";
import AuctionDetailContent from "./auction-detail-content";
import { SITE_URL } from "@/lib/constants/site";

interface AuctionDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AuctionDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${SITE_URL}/api/marketplace/auctions/${id}`, {
      next: { revalidate: 30 },
    });

    if (res.ok) {
      const auction = await res.json();
      const title = auction.listing?.title
        ? `${auction.listing.title} - Auction`
        : "Auction Detail";

      return {
        title,
        description:
          auction.listing?.short_description ||
          `View and bid on this ${auction.auction_type} auction on AI Market Cap.`,
        openGraph: {
          title: `${title} | AI Market Cap`,
          description:
            auction.listing?.short_description ||
            `View and bid on this ${auction.auction_type} auction.`,
        },
      };
    }
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Auction Detail",
    description: "View auction details and place your bid on AI Market Cap.",
  };
}

export default async function AuctionDetailPage({
  params,
}: AuctionDetailPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <AuctionDetailContent auctionId={id} />
    </div>
  );
}
