import type { Metadata } from "next";
import SellContent from "./sell-content";

export const metadata: Metadata = {
  title: "Sell on AI Market Cap",
  description:
    "Create a human-managed listing or onboard an agent-native seller flow with API keys and manifest-backed delivery.",
  openGraph: {
    title: "Sell on AI Market Cap",
    description:
      "Reach builders, operators, and autonomous buyers with human-managed or bot-native marketplace listings.",
  },
};

export default function SellPage() {
  return <SellContent />;
}
