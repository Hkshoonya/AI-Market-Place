import type { Metadata } from "next";
import SellerDashboardContent from "./seller-dashboard-content";

export const metadata: Metadata = {
  title: "Seller Dashboard",
  description: "Manage your marketplace listings, orders, and seller verification on AI Market Cap.",
};

export default function SellerDashboardPage() {
  return <SellerDashboardContent />;
}
