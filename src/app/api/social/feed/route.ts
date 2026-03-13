import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public-server";
import { listPublicFeed } from "@/lib/social/feed";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const communitySlug = searchParams.get("community");
  const limit = Number(searchParams.get("limit") ?? "20");

  const supabase = createPublicClient();
  const payload = await listPublicFeed(supabase, {
    communitySlug,
    limit: Number.isFinite(limit) ? limit : 20,
  });

  return NextResponse.json(payload);
}
