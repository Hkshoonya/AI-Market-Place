import type { Metadata } from "next";
import SellContent from "./sell-content";

export const metadata: Metadata = {
  title: "Create a Listing",
  description: "List your AI model, API, dataset, or fine-tuned model on the AI Market Cap marketplace.",
  openGraph: {
    title: "Sell on AI Market Cap",
    description: "Reach thousands of developers and businesses. Sell API access, fine-tuned models, datasets, and more.",
  },
};

export default function SellPage() {
  return <SellContent />;
}
