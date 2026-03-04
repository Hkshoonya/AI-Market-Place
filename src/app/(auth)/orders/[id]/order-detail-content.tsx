"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatRelativeDate, formatCurrency } from "@/lib/format";
import type { MarketplaceOrder } from "@/types/database";

type OrderParty = { display_name: string | null; avatar_url: string | null; username: string | null };

type OrderWithParties = MarketplaceOrder & {
  marketplace_listings?: { title: string | null; slug: string | null; listing_type: string | null } | null;
  buyer?: OrderParty | null;
  seller?: OrderParty | null;
};

type OrderMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string | null; username: string | null } | null;
};

const supabase = createClient();

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-500 border-amber-500/30 bg-amber-500/5", label: "Pending" },
  approved: { icon: CheckCircle2, color: "text-blue-500 border-blue-500/30 bg-blue-500/5", label: "Approved" },
  completed: { icon: CheckCircle2, color: "text-gain border-gain/30 bg-gain/5", label: "Completed" },
  rejected: { icon: XCircle, color: "text-loss border-loss/30 bg-loss/5", label: "Rejected" },
  cancelled: { icon: XCircle, color: "text-muted-foreground border-border bg-secondary/30", label: "Cancelled" },
};

export default function OrderDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orderId, setOrderId] = useState<string>("");
  const [order, setOrder] = useState<OrderWithParties | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  const fetchOrder = useCallback(async () => {
    if (!user || !orderId) return;

    const { data: rawData } = await supabase
      .from("marketplace_orders")
      .select(
        "*, marketplace_listings(title, slug, listing_type), buyer:buyer_id(display_name, avatar_url, username), seller:seller_id(display_name, avatar_url, username)"
      )
      .eq("id", orderId)
      .single();

    const data = rawData as unknown as OrderWithParties | null;
    if (data && (data.buyer_id === user.id || data.seller_id === user.id)) {
      setOrder(data);
    }
    setLoading(false);
  }, [user, orderId]);

  const fetchMessages = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/marketplace/orders/${orderId}/messages`);
      const json = await res.json();
      if (res.ok) {
        setMessages(json.data ?? []);
      }
    } catch {
      // ignore
    }
  }, [orderId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/orders");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && orderId) {
      fetchOrder();
      fetchMessages();
    }
  }, [user, orderId, fetchOrder, fetchMessages]);

  // Poll for new messages
  useEffect(() => {
    if (!orderId) return;
    const interval = setInterval(fetchMessages, 15_000);
    return () => clearInterval(interval);
  }, [orderId, fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/marketplace/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [...prev, json.data]);
        setNewMessage("");
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Order not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/orders">Back to Orders</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const isBuyer = order.buyer_id === user.id;
  const otherParty = isBuyer ? order.seller : order.buyer;
  const listing = order.marketplace_listings;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      {/* Order info */}
      <Card className="border-border/50 bg-card mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">
              {listing?.title || "Order Details"}
            </CardTitle>
            <Badge variant="outline" className={`${statusConfig.color}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">
                {isBuyer ? "Seller" : "Buyer"}:
              </span>{" "}
              <span className="font-medium">
                {otherParty?.display_name || otherParty?.username || "Unknown"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>{" "}
              <span>{formatDate(order.created_at)}</span>
            </div>
            {order.price_at_time != null && (
              <div>
                <span className="text-muted-foreground">Price:</span>{" "}
                <span className="font-medium">{formatCurrency(order.price_at_time)}</span>
              </div>
            )}
            {listing?.slug && (
              <div>
                <Link
                  href={`/marketplace/${listing.slug}`}
                  className="text-neon hover:underline inline-flex items-center gap-1"
                >
                  View Listing <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
          {order.message && (
            <div className="mt-3 rounded-lg bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Order note</p>
              <p className="text-sm">{order.message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-neon" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages list */}
          <div className="max-h-96 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-xs text-muted-foreground">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-2 ${
                        isMe
                          ? "bg-neon/10 text-foreground"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                        {isMe ? "You" : msg.profiles?.display_name || msg.profiles?.username || "User"}
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatRelativeDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send message */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-border/30 px-4 py-3"
          >
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              className="gap-2 bg-neon text-background hover:bg-neon/90"
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
