import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

const createBookmarkSchema = z.object({
  model_id: z.string().uuid("model_id must be a valid UUID"),
});

export const dynamic = "force-dynamic";

// GET /api/bookmarks — list all bookmarks for the authenticated user
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`bookmarks:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_bookmarks")
      .select("id, model_id, created_at, models(id, slug, name, provider, category, overall_rank, quality_score, hf_downloads)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/bookmarks");
  }
}

// POST /api/bookmarks — add a bookmark
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`bookmarks-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = createBookmarkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { model_id } = parsed.data;

    const { data, error } = await supabase
      .from("user_bookmarks")
      .upsert({ user_id: user.id, model_id }, { onConflict: "user_id,model_id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "api/bookmarks");
  }
}

// DELETE /api/bookmarks — remove a bookmark
export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`bookmarks-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    const { searchParams } = new URL(request.url);
    const model_id = searchParams.get("model_id");

    if (!model_id) {
      return NextResponse.json({ error: "model_id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("model_id", model_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "api/bookmarks");
  }
}
