import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sell on Marketplace",
  description:
    "List your AI models, datasets, and tools for sale on the AI Market Cap marketplace.",
};

export default function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
