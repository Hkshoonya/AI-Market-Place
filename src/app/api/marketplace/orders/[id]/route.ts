import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { status } = body;

  const validStatuses = ["approved", "rejected", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch the current order to validate ownership and status transition
  const { data: currentOrder, error: fetchError } = await sb
    .from("marketplace_orders")
    .select("*")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (fetchError || !currentOrder) {
    return NextResponse.json(
      { error: "Not found or not authorized" },
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

  const { data, error } = await sb
    .from("marketplace_orders")
    .update({ status })
    .eq("id", id)
    .eq("seller_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
