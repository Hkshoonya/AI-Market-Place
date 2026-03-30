import type { Metadata } from "next";
import AuctionsBrowseContent from "./auctions-browse-content";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Auctions",
  description:
    "Browse and bid on AI models, APIs, datasets, and more in live auctions.",
  openGraph: {
    title: "Auctions | AI Market Cap",
    description:
      "Browse and bid on AI models, APIs, datasets, and more in live auctions.",
    url: `${SITE_URL}/marketplace/auctions`,
  },
  alternates: {
    canonical: `${SITE_URL}/marketplace/auctions`,
  },
};

export default function AuctionsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <AuctionsBrowseContent />
    </div>
  );
}
