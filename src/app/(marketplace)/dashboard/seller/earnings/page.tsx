import type { Metadata } from "next";
import SellerEarningsContent from "./seller-earnings-content";

export const metadata: Metadata = {
  title: "Seller Earnings & Payouts",
  description:
    "View your earnings, manage withdrawals, and track transaction history on AI Market Cap.",
};

export default function SellerEarningsPage() {
  return <SellerEarningsContent />;
}
