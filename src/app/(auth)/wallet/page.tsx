import type { Metadata } from "next";
import WalletContent from "./wallet-content";

export const metadata: Metadata = {
  title: "Wallet",
  description:
    "Manage your crypto wallet, view balance, and transaction history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WalletPage() {
  return <WalletContent />;
}
