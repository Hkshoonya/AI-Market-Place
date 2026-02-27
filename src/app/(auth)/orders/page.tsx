import type { Metadata } from "next";
import OrdersContent from "./orders-content";

export const metadata: Metadata = {
  title: "My Orders",
  description: "View and manage your marketplace orders.",
};

export default function OrdersPage() {
  return <OrdersContent />;
}
