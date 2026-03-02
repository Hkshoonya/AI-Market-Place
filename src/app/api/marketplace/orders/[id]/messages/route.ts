import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/marketplace/orders/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const ip = getClientIp(request);
  const rl = rateLimit(`order-messages:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to view order messages." },
      { status: 401 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Verify user is part of this order
  const { data: order } = await sb
    .from("marketplace_orders")
    .select("id, buyer_id, seller_id")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    return NextResponse.json(
      { error: "Order not found, or you do not have access to its messages." },
      { status: 404 }
    );
  }

  // Get messages — two-query approach (order_messages may not have FK to profiles)
  const { data: rawMessages } = await sb
    .from("order_messages")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  // Enrich with sender profiles
  let messages = rawMessages ?? [];
  if (messages.length > 0) {
    const senderIds = [...new Set(messages.map((m: any) => m.sender_id).filter(Boolean))];
    if (senderIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .in("id", senderIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      messages = messages.map((m: any) => ({
        ...m,
        profiles: m.sender_id ? profileMap.get(m.sender_id) ?? null : null,
      }));
    }
  }

  // Mark unread messages from the other party as read
  await sb
    .from("order_messages")
    .update({ is_read: true })
    .eq("order_id", orderId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({ data: messages });
}

// POST /api/marketplace/orders/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const ip = getClientIp(request);
  const rl = rateLimit(`order-messages-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to send a message." },
      { status: 401 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Verify user is part of this order
  const { data: order } = await sb
    .from("marketplace_orders")
    .select("id, buyer_id, seller_id")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    return NextResponse.json(
      { error: "Order not found, or you do not have permission to send messages." },
      { status: 404 }
    );
  }

  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  const messageSchema = z.object({
    content: z.string().min(1, "Message content is required").max(5000, "Message too long (max 5000 characters)"),
  });

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Validation failed" },
      { status: 400 }
    );
  }
  const { content } = parsed.data;

  const { data: rawMsg, error } = await sb
    .from("order_messages")
    .insert({
      order_id: orderId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 }
    );
  }

  // Enrich with sender profile
  let data = rawMsg;
  if (rawMsg?.sender_id) {
    const { data: profile } = await sb
      .from("profiles")
      .select("id, display_name, avatar_url, username")
      .eq("id", rawMsg.sender_id)
      .single();
    data = { ...rawMsg, profiles: profile ?? null };
  }

  // Notify the other party (non-critical, log errors only)
  const otherUserId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
  const { error: notifError } = await sb.from("notifications").insert({
    user_id: otherUserId,
    type: "order_update",
    title: "New message on your order",
    message: content.trim().substring(0, 100),
    link: `/orders/${orderId}`,
  });
  if (notifError) {
    console.error("Failed to insert order message notification:", notifError.message);
  }

  return NextResponse.json({ data });
}
