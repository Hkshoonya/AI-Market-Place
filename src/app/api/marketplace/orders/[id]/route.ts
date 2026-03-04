import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { completePurchaseEscrow, refundPurchaseEscrow } from "@/lib/marketplace/escrow";
import { deliverDigitalGood } from "@/lib/marketplace/delivery";
import type { MarketplaceOrder } from "@/types/database";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`order-update:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { id } = await params;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to update this order." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { status } = body as { status: string };

  const validStatuses = ["approved", "rejected", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status "${status}". Must be one of: ${validStatuses.join(", ")}.` },
      { status: 400 }
    );
  }

  // Fetch the current order to validate ownership and status transition
  const { data: rawOrder, error: fetchError } = await supabase
    .from("marketplace_orders")
    .select("*")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  const currentOrder = rawOrder as MarketplaceOrder | null;

  if (fetchError || !currentOrder) {
    return NextResponse.json(
      { error: "Order not found, or you do not have permission to update it." },
      { status: 404 }
    );
  }

  // Validate status transition
  const allowedTransitions: Record<string, string[]> = {
    pending: ["approved", "rejected", "cancelled"],
    approved: ["completed", "cancelled"],
    rejected: [],
    completed: [],
    cancelled: [],
  };

  const allowed = allowedTransitions[currentOrder.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json(
      {
        error: `Cannot transition from "${currentOrder.status}" to "${status}".`,
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("marketplace_orders")
    .update({ status: status as MarketplaceOrder["status"] })
    .eq("id", id)
    .eq("seller_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update order status. Please try again later." },
      { status: 500 }
    );
  }

  // After successful status update, handle escrow and delivery
  let deliveryResult = null;

  if (status === "completed") {
    try {
      await completePurchaseEscrow(id);
      deliveryResult = await deliverDigitalGood(id, currentOrder.listing_id, currentOrder.buyer_id);
    } catch (escrowErr) {
      void systemLog.error("api/marketplace/orders", "Escrow/delivery failed for order", { orderId: id, error: escrowErr instanceof Error ? escrowErr.message : String(escrowErr) });
    }
  }

  if (status === "cancelled" || status === "rejected") {
    try {
      await refundPurchaseEscrow(id);
    } catch (refundErr) {
      void systemLog.error("api/marketplace/orders", "Escrow refund failed for order", { orderId: id, error: refundErr instanceof Error ? refundErr.message : String(refundErr) });
    }
  }

  return NextResponse.json({ data, delivery: deliveryResult });
  } catch (err) {
    return handleApiError(err, "api/marketplace/orders");
  }
}
