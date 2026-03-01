import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { enrichListingWithProfile, PROFILE_FIELDS_FULL } from "@/lib/marketplace/enrich-listings";

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

  const { data: rawListing, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !rawListing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Enrich with seller profile (no FK constraint exists, so fetch separately)
  const data = await enrichListingWithProfile(
    supabase as any,
    rawListing,
    PROFILE_FIELDS_FULL
  );

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
    return NextResponse.json(
      { error: "Authentication required. Please sign in to edit this listing." },
      { status: 401 }
    );
  }

  const rl = rateLimit(`listing-edit:${user.id}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

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
    "status",
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
    return NextResponse.json(
      { error: "Failed to update listing. Please try again later." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Listing not found, or you do not have permission to edit it." },
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
    return NextResponse.json(
      { error: "Authentication required. Please sign in to delete this listing." },
      { status: 401 }
    );
  }

  const rl = rateLimit(`listing-delete:${user.id}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { error } = await (supabase as any)
    .from("marketplace_listings")
    .delete()
    .eq("slug", slug)
    .eq("seller_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete listing. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
