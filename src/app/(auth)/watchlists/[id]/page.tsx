import type { Metadata } from "next";
import WatchlistDetailContent from "./watchlist-detail-content";

export const metadata: Metadata = {
  title: "Watchlist Details",
  description: "View and manage the AI models in your watchlist.",
};

export default function WatchlistDetailPage() {
  return <WatchlistDetailContent />;
}
