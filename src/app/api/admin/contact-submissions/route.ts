import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-contact-submissions:${ip}`, RATE_LIMITS.api);
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "5", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 5;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("contact_submissions")
      .select("id, name, email, category, subject, message, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (data ?? []).map((submission) => {
      const metadata =
        submission.metadata && typeof submission.metadata === "object"
          ? (submission.metadata as Record<string, unknown>)
          : {};
      const listingSlug = readString(metadata, "listing_slug");

      return {
        id: submission.id,
        name: submission.name,
        email: submission.email,
        category: submission.category,
        subject: submission.subject,
        message: submission.message,
        created_at: submission.created_at,
        sellerId: readString(metadata, "seller_id"),
        listingId: readString(metadata, "listing_id"),
        listingTitle: readString(metadata, "listing_title"),
        listingSlug,
        link: listingSlug ? `/marketplace/${listingSlug}` : null,
      };
    });

    return NextResponse.json({ data: normalized });
  } catch (err) {
    return handleApiError(err, "api/admin/contact-submissions");
  }
}
