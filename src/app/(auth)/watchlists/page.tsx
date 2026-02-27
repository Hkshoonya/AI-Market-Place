import type { Metadata } from "next";
import WatchlistsContent from "./watchlists-content";

export const metadata: Metadata = {
  title: "Your Watchlists",
  description: "Create and manage watchlists to track your favorite AI models and get personalized updates.",
};

export default function WatchlistsPage() {
  return <WatchlistsContent />;
}
