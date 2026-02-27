import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Dashboard",
  description:
    "Manage your marketplace listings, orders, and analytics.",
};

export default function SellerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
