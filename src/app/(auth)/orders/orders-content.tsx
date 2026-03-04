"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Package,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatCurrency } from "@/lib/format";
import type { MarketplaceOrder } from "@/types/database";

// Orders from buyer view with joined seller profile and listing
type OrderWithJoins = MarketplaceOrder & {
  marketplace_listings?: { title: string | null; slug: string | null; listing_type: string | null; thumbnail_url?: string | null } | null;
  seller?: { display_name: string | null; avatar_url: string | null; username: string | null } | null;
};

const supabase = createClient();

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-500 border-amber-500/30", label: "Pending" },
  approved: { icon: CheckCircle2, color: "text-blue-500 border-blue-500/30", label: "Approved" },
  completed: { icon: CheckCircle2, color: "text-gain border-gain/30", label: "Completed" },
  rejected: { icon: XCircle, color: "text-loss border-loss/30", label: "Rejected" },
  cancelled: { icon: XCircle, color: "text-muted-foreground border-border", label: "Cancelled" },
};

export default function OrdersContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("marketplace_orders")
      .select(
        "*, marketplace_listings(title, slug, listing_type, thumbnail_url), seller:seller_id(display_name, avatar_url, username)"
      )
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter as import("@/types/database").OrderStatus);
    }

    const { data } = await query;
    setOrders((data as unknown as OrderWithJoins[]) ?? []);
    setLoading(false);
  }, [user, filter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/orders");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user, fetchOrders]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
          <ShoppingBag className="h-5 w-5 text-neon" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-sm text-muted-foreground">
            Track your marketplace purchases
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {[
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "approved", label: "Approved" },
          { key: "completed", label: "Completed" },
          { key: "rejected", label: "Rejected" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
            className={filter === f.key ? "bg-neon text-background hover:bg-neon/90" : ""}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
          ))
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card px-6 py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">No orders found</p>
            <Button asChild className="mt-4 bg-neon text-background hover:bg-neon/90">
              <Link href="/marketplace">Browse Marketplace</Link>
            </Button>
          </div>
        ) : (
          orders.map((order) => {
            const listing = order.marketplace_listings;
            const seller = order.seller;
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={order.id}
                className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-secondary/20"
              >
                {/* Listing info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {listing?.title || "Unknown Listing"}
                    </p>
                    <Badge variant="outline" className={`text-[10px] ${statusConfig.color}`}>
                      <StatusIcon className="h-2.5 w-2.5 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Seller: {seller?.display_name || seller?.username || "Unknown"}
                    </span>
                    <span>·</span>
                    <span>{formatDate(order.created_at)}</span>
                    {order.price_at_time != null && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(order.price_at_time)}
                        </span>
                      </>
                    )}
                  </div>
                  {order.message && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {order.message}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 px-3 gap-1.5 text-xs" asChild>
                    <Link href={`/orders/${order.id}`}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      Messages
                    </Link>
                  </Button>
                  {listing?.slug && (
                    <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                      <Link href={`/marketplace/${listing.slug}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
