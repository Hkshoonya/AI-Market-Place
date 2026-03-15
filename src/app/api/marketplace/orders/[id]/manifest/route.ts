import { NextRequest, NextResponse } from "next/server";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`order-manifest:${ip}`, RATE_LIMITS.write);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to continue." },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { data: order, error } = await supabase
      .from("marketplace_orders")
      .select("id, buyer_id, seller_id, fulfillment_manifest_snapshot")
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.is_admin === true;
    const isBuyer = order.buyer_id === user.id;
    const isSeller = order.seller_id === user.id;

    if (!isAdmin && !isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "You do not have permission to access this order manifest." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      manifest: order.fulfillment_manifest_snapshot,
    });
  } catch (err) {
    return handleApiError(err, "api/marketplace/orders/manifest");
  }
}
