import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = rateLimit(`listing-detail:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(
      "*, profiles!marketplace_listings_seller_id_fkey(id, display_name, avatar_url, username, is_seller, seller_verified, seller_rating, total_sales, seller_bio, seller_website, created_at)"
    )
    .eq("slug", slug)
    .single();

  if (error) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Increment view count (fire-and-forget)
  supabase
    .from("marketplace_listings")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", data.id)
    .then();

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { createClient: createServerClient } = await import(
    "@/lib/supabase/server"
  );
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Filter to only allowed fields (prevent mass assignment)
  const ALLOWED_FIELDS = [
    "title",
    "short_description",
    "description",
    "listing_type",
    "pricing_type",
    "price",
    "currency",
    "tags",
    "documentation_url",
    "demo_url",
    "source_url",
    "agent_config",
    "mcp_manifest",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // Always set updated_at
  updates.updated_at = new Date().toISOString();

  const { data, error } = await (supabase as any)
    .from("marketplace_listings")
    .update(updates)
    .eq("slug", slug)
    .eq("seller_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Not found or not authorized" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { createClient: createServerClient } = await import(
    "@/lib/supabase/server"
  );
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await (supabase as any)
    .from("marketplace_listings")
    .delete()
    .eq("slug", slug)
    .eq("seller_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
