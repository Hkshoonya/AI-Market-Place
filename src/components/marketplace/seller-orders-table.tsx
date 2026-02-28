"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MarketplaceOrder, OrderStatus } from "@/types/database";

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-neon/30 bg-neon/10 text-neon",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
  completed: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  cancelled: "border-border/50 text-muted-foreground",
};

export function SellerOrdersTable() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select("*, marketplace_listings(title, slug, listing_type), profiles!marketplace_orders_buyer_id_fkey(display_name, avatar_url)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data as MarketplaceOrder[]) || []);
    } catch {
      console.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setProcessingId(orderId);
    try {
      const res = await fetch(`/api/marketplace/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update order status");
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      toast.success(`Order ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order status");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/50" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No orders yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Orders will appear here when buyers request access to your listings.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="border-border/30 hover:bg-transparent">
            <TableHead className="text-xs">Listing</TableHead>
            <TableHead className="text-xs">Buyer</TableHead>
            <TableHead className="text-xs">Message</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const listingTitle = order.marketplace_listings?.title || "Unknown Listing";
            const listingSlug = order.marketplace_listings?.slug;
            const buyerName = order.profiles?.display_name || "Unknown Buyer";
            const isProcessing = processingId === order.id;

            return (
              <TableRow key={order.id} className="border-border/30">
                <TableCell>
                  {listingSlug ? (
                    <Link
                      href={`/marketplace/${listingSlug}`}
                      className="text-sm font-medium hover:text-neon transition-colors"
                    >
                      {listingTitle}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{listingTitle}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{buyerName}</span>
                </TableCell>
                <TableCell>
                  {order.message ? (
                    <p className="max-w-[200px] truncate text-xs text-muted-foreground" title={order.message}>
                      {order.message}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground">No message</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("text-[11px]", STATUS_COLORS[order.status])}
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(order.created_at)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {order.status === "pending" ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neon hover:bg-neon/10"
                        disabled={isProcessing}
                        onClick={() => updateOrderStatus(order.id, "approved")}
                        title="Approve"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                        disabled={isProcessing}
                        onClick={() => updateOrderStatus(order.id, "rejected")}
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
