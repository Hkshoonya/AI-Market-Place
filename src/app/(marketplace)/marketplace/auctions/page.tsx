import type { Metadata } from "next";
import AuctionsBrowseContent from "./auctions-browse-content";

export const metadata: Metadata = {
  title: "Auctions",
  description:
    "Browse and bid on AI models, APIs, datasets, and more in live auctions.",
  openGraph: {
    title: "Auctions | AI Market Cap",
    description:
      "Browse and bid on AI models, APIs, datasets, and more in live auctions.",
  },
};

export default function AuctionsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <AuctionsBrowseContent />
    </div>
  );
}
