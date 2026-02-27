import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get messages
  const { data: messages } = await sb
    .from("order_messages")
    .select("*, profiles:sender_id(display_name, avatar_url, username)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  // Mark unread messages from the other party as read
  await sb
    .from("order_messages")
    .update({ is_read: true })
    .eq("order_id", orderId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({ data: messages ?? [] });
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: "Message content is required." }, { status: 400 });
  }

  const { data, error } = await sb
    .from("order_messages")
    .insert({
      order_id: orderId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select("*, profiles:sender_id(display_name, avatar_url, username)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the other party
  const otherUserId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
  await sb.from("notifications").insert({
    user_id: otherUserId,
    type: "order_update",
    title: "New message on your order",
    message: content.trim().substring(0, 100),
    link: `/orders/${orderId}`,
  });

  return NextResponse.json({ data });
}
