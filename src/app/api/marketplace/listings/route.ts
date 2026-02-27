import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const sort = searchParams.get("sort") || "newest";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const search = searchParams.get("q");
  const pricingType = searchParams.get("pricing_type");
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");

  let query = supabase
    .from("marketplace_listings")
    .select(
      "*, profiles!marketplace_listings_seller_id_fkey(id, display_name, avatar_url, username, is_seller, seller_verified, seller_rating, total_sales)",
      { count: "exact" }
    )
    .eq("status", "active");

  if (type) query = query.eq("listing_type", type);
  if (pricingType) query = query.eq("pricing_type", pricingType);
  if (search) query = query.textSearch("fts", search);
  if (minPrice) query = query.gte("price", parseFloat(minPrice));
  if (maxPrice) query = query.lte("price", parseFloat(maxPrice));

  // Sorting
  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    newest: { column: "created_at", ascending: false },
    price_asc: { column: "price", ascending: true },
    price_desc: { column: "price", ascending: false },
    rating: { column: "avg_rating", ascending: false },
    popular: { column: "view_count", ascending: false },
  };

  const sortConfig = sortMap[sort] || sortMap.newest;
  query = query.order(sortConfig.column, {
    ascending: sortConfig.ascending,
    nullsFirst: false,
  });
  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
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
  const {
    title,
    description,
    short_description,
    listing_type,
    pricing_type,
    price,
    currency,
    model_id,
    tags,
    thumbnail_url,
    demo_url,
    documentation_url,
  } = body;

  if (!title || !description || !listing_type) {
    return NextResponse.json(
      { error: "Title, description, and listing_type are required" },
      { status: 400 }
    );
  }

  // Generate slug from title
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  // Mark user as seller if not already
  await (supabase as any)
    .from("profiles")
    .update({ is_seller: true })
    .eq("id", user.id);

  const { data, error } = await (supabase as any)
    .from("marketplace_listings")
    .insert({
      seller_id: user.id,
      slug,
      title,
      description,
      short_description: short_description || null,
      listing_type,
      status: "active",
      pricing_type: pricing_type || "one_time",
      price: price ?? null,
      currency: currency || "USD",
      model_id: model_id || null,
      tags: tags || [],
      thumbnail_url: thumbnail_url || null,
      demo_url: demo_url || null,
      documentation_url: documentation_url || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
