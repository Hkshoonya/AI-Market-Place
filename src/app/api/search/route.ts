import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await supabase
    .from("models")
    .select("id, slug, name, provider, category, overall_rank, quality_score")
    .textSearch("fts", query)
    .eq("status", "active")
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
