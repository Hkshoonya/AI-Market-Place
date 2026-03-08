import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseQueryResult, parseQueryResultSingle } from "@/lib/schemas/parse";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Standalone flat type — avoids intersection conflict with OrderMessage.profiles optional field
type MsgWithProfile = {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  profiles: Record<string, unknown> | null;
};

// GET /api/marketplace/orders/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      {
        error:
          "Authentication required. Please sign in to view order messages.",
      },
      { status: 401 }
    );
  }

  // Verify user is part of this order
  const { data: order } = await supabase
    .from("marketplace_orders")
    .select("id, buyer_id, seller_id")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    return NextResponse.json(
      {
        error:
          "Order not found, or you do not have access to its messages.",
      },
      { status: 404 }
    );
  }

  // Get messages — two-query approach (order_messages may not have FK to profiles)
  const MsgSchema = z.object({
    id: z.string(),
    order_id: z.string(),
    sender_id: z.string(),
    content: z.string(),
    is_read: z.boolean(),
    created_at: z.string(),
  });
  const messagesResponse = await supabase
    .from("order_messages")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  // Enrich with sender profiles
  let messages: MsgWithProfile[] = parseQueryResult(messagesResponse, MsgSchema, "OrderMessages").map(m => ({ ...m, profiles: null }));
  if (messages.length > 0) {
    const senderIds = [
      ...new Set(messages.map((m) => m.sender_id).filter(Boolean)),
    ];
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .in("id", senderIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      messages = messages.map((m) => ({
        ...m,
        profiles: m.sender_id ? profileMap.get(m.sender_id) ?? null : null,
      }));
    }
  }

  // Mark unread messages from the other party as read
  await supabase
    .from("order_messages")
    .update({ is_read: true })
    .eq("order_id", orderId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({ data: messages });
  } catch (err) {
    return handleApiError(err, "api/marketplace/orders/messages");
  }
}

// POST /api/marketplace/orders/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      {
        error:
          "Authentication required. Please sign in to send a message.",
      },
      { status: 401 }
    );
  }

  // Verify user is part of this order
  const { data: order } = await supabase
    .from("marketplace_orders")
    .select("id, buyer_id, seller_id")
    .eq("id", orderId)
    .single();

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    return NextResponse.json(
      {
        error:
          "Order not found, or you do not have permission to send messages.",
      },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  const messageSchema = z.object({
    content: z
      .string()
      .min(1, "Message content is required")
      .max(5000, "Message too long (max 5000 characters)"),
  });

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Validation failed" },
      { status: 400 }
    );
  }
  const { content } = parsed.data;

  const InsertMsgSchema = z.object({
    id: z.string(),
    order_id: z.string(),
    sender_id: z.string(),
    content: z.string(),
    is_read: z.boolean(),
    created_at: z.string(),
  });
  const insertResponse = await supabase
    .from("order_messages")
    .insert({
      order_id: orderId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select("*")
    .single();

  if (insertResponse.error) {
    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 }
    );
  }

  // Validate insert result for profile enrichment
  const rawMsg = parseQueryResultSingle(insertResponse, InsertMsgSchema, "OrderMessageInsert");

  // Enrich with sender profile
  let data: Record<string, unknown> = (rawMsg ?? {}) as Record<string, unknown>;
  if (rawMsg?.sender_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, username")
      .eq("id", rawMsg.sender_id)
      .single();
    data = { ...rawMsg, profiles: profile ?? null };
  }

  // Notify the other party (non-critical, log errors only)
  const otherUserId =
    order.buyer_id === user.id ? order.seller_id : order.buyer_id;
  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: otherUserId,
    type: "order_update",
    title: "New message on your order",
    message: content.trim().substring(0, 100),
    link: `/orders/${orderId}`,
  });
  if (notifError) {
    void systemLog.warn("api/marketplace/orders/messages", "Failed to insert order message notification", { error: notifError.message });
  }

  return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/marketplace/orders/messages");
  }
}
