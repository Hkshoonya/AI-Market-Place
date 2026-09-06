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
import { z } from "zod";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

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
      .select("is_admin, is_banned")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin || profile.is_banned === true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "5", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 5;

    const admin = createAdminClient();
    let query = admin
      .from("contact_submissions")
      .select("id, name, email, category, subject, message, status, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (searchParams.get("commercial") === "true") {
      query = query.in("category", ["partnership", "sponsorship"]);
    }
    const status = StatusSchema.shape.status.safeParse(searchParams.get("status"));
    if (status.success) {
      query = query.eq("status", status.data);
    }
    const { data, error } = await query;

    if (error) {
      throw error;
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
        status: submission.status ?? "new",
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

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "read", "replied", "archived"]),
});

export async function PATCH(request: NextRequest) {
  try {
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("is_admin, is_banned").eq("id", user.id).single();
    if (!profile?.is_admin || profile.is_banned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rl = await rateLimit(`admin-contact-status:${user.id}`, RATE_LIMITS.api);
    if (!rl.success) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: rateLimitHeaders(rl) });
    const parsed = StatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid submission status" }, { status: 400 });
    const { data, error } = await createAdminClient().from("contact_submissions")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id).select("id, status").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "api/admin/contact-submissions");
  }
}
