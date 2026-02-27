import type { Metadata } from "next";
import OrderDetailContent from "./order-detail-content";

export const metadata: Metadata = {
  title: "Order Details",
  description: "View order details and communicate with the seller.",
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <OrderDetailContent params={params} />;
}
