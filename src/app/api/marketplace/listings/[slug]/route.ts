import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { enrichListingWithProfile, PROFILE_FIELDS_FULL } from "@/lib/marketplace/enrich-listings";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`listing-detail:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { slug } = await params;

  // Check if admin is requesting (allows viewing non-active listings)
  const adminParam = request.nextUrl.searchParams.get("admin");
  let isAdmin = false;

  if (adminParam === "true") {
    try {
      const { createClient: createServerClient } = await import(
        "@/lib/supabase/server"
      );
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await serverSupabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        isAdmin = profile?.is_admin === true;
      }
    } catch {
      // Ignore — fall back to public view
    }
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let query = supabase
    .from("marketplace_listings")
    .select("*")
    .eq("slug", slug);

  // Non-admin users can only see active listings
  if (!isAdmin) {
    query = query.eq("status", "active");
  }

  const { data: rawListing, error } = await query.single();

  if (error || !rawListing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Enrich with seller profile (no FK constraint exists, so fetch separately)
  // enrichListingWithProfile accepts AnyClient internally
  const data = await enrichListingWithProfile(
    supabase,
    rawListing,
    PROFILE_FIELDS_FULL
  );

  return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const bodyObj = body as Record<string, unknown>;

  // Split fields: sellers vs admin-only
  const SELLER_FIELDS = [
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
    "model_id",
    "thumbnail_url",
  ] as const;

  const ADMIN_ONLY_FIELDS = ["status", "is_featured"] as const;

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true;

  const allowedFields = isAdmin
    ? [...SELLER_FIELDS, ...ADMIN_ONLY_FIELDS]
    : [...SELLER_FIELDS];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in bodyObj) {
      updates[field] = bodyObj[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // Basic type validation on critical fields
  if ("price" in updates && updates.price !== null) {
    const p = Number(updates.price);
    if (isNaN(p) || p < 0 || p > 10_000_000) {
      return NextResponse.json({ error: "Invalid price value" }, { status: 400 });
    }
  }
  if ("title" in updates && typeof updates.title === "string") {
    if (updates.title.length < 1 || updates.title.length > 500) {
      return NextResponse.json({ error: "Title must be 1-500 characters" }, { status: 400 });
    }
  }

  // Always set updated_at
  updates.updated_at = new Date().toISOString();

  let query = supabase
    .from("marketplace_listings")
    .update(updates as unknown as import("@/types/database").MarketplaceListing)
    .eq("slug", slug);

  // Non-admin users can only edit their own listings
  if (!isAdmin) {
    query = query.eq("seller_id", user.id);
  }

  const { data, error } = await query.select().single();

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
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
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

  const { error } = await supabase
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
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings");
  }
}
