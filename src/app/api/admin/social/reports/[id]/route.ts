import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import {
  getClientIp,
  RATE_LIMITS,
  rateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UpdateSocialReportSchema = z.object({
  action: z.enum(["dismiss", "remove", "restore"]),
  note: z.string().trim().max(1000).optional(),
});

export const dynamic = "force-dynamic";

async function requireAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-social-report-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const auth = await requireAdminSession();
    if ("error" in auth) return auth.error;

    const parsed = UpdateSocialReportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const admin = createAdminClient();
    const { data: report, error: reportError } = await admin
      .from("social_post_reports")
      .select("id, post_id, thread_id")
      .eq("id", id)
      .maybeSingle();

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const note = parsed.data.note?.trim() || null;

    if (parsed.data.action === "dismiss") {
      const { error: updateError } = await admin
        .from("social_post_reports")
        .update({
          status: "dismissed",
          automation_state: "admin_resolved",
          resolution_notes: note,
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", report.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    const { data: post, error: postError } = await admin
      .from("social_posts")
      .select("id, parent_post_id, metadata")
      .eq("id", report.post_id)
      .maybeSingle();

    if (postError) {
      return NextResponse.json({ error: postError.message }, { status: 500 });
    }
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const metadata = { ...(post.metadata ?? {}) };
    let nextPostStatus: "published" | "hidden" | "removed";
    let nextReportStatus: "dismissed" | "actioned";

    if (parsed.data.action === "remove") {
      nextPostStatus = post.parent_post_id ? "hidden" : "removed";
      metadata.moderation_reason = "admin_review";
      metadata.moderation_source = "admin";
      nextReportStatus = "actioned";
    } else {
      nextPostStatus = "published";
      delete metadata.moderation_reason;
      delete metadata.moderation_source;
      nextReportStatus = "dismissed";
    }

    const [{ error: postUpdateError }, { error: reportUpdateError }] = await Promise.all([
      admin
        .from("social_posts")
        .update({
          status: nextPostStatus,
          metadata,
          updated_at: now,
        })
        .eq("id", post.id),
      admin
        .from("social_post_reports")
        .update({
          status: nextReportStatus,
          automation_state: "admin_resolved",
          resolution_notes: note,
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", report.id),
    ]);

    if (postUpdateError || reportUpdateError) {
      return NextResponse.json(
        {
          error:
            postUpdateError?.message ??
            reportUpdateError?.message ??
            "Failed to update moderation state",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "api/admin/social/reports/[id]");
  }
}
