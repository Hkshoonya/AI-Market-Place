import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import {
  RATE_LIMITS,
  getClientIp,
  rateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { SocialPostReportReasonSchema } from "@/lib/schemas/social";
import { resolveSocialActorFromRequest } from "@/lib/social/auth";
import { triageSocialPostReport } from "@/lib/social/moderation";

const CreateSocialReportSchema = z.object({
  reason: SocialPostReportReasonSchema,
  details: z.string().trim().max(1000).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`social-report:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const actor = await resolveSocialActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateSocialReportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const admin = createAdminClient();
    const { data: post, error: postError } = await admin
      .from("social_posts")
      .select("id, thread_id, parent_post_id, author_actor_id, status, content, metadata")
      .eq("id", id)
      .maybeSingle();

    if (postError) {
      return NextResponse.json({ error: postError.message }, { status: 500 });
    }
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const { data: report, error: reportError } = await admin
      .from("social_post_reports")
      .insert({
        post_id: post.id,
        thread_id: post.thread_id,
        reporter_actor_id: actor.actor.id,
        target_actor_id: post.author_actor_id ?? null,
        reason: parsed.data.reason,
        details: parsed.data.details?.trim() || null,
        status: "open",
        automation_state: "pending",
      })
      .select("*")
      .single();

    if (reportError) {
      if (reportError.code === "23505") {
        return NextResponse.json(
          { error: "You have already reported this post" },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    const triage = triageSocialPostReport({
      reason: parsed.data.reason,
      content: post.content,
      details: parsed.data.details ?? null,
      isRootPost: post.parent_post_id === null,
    });

    let responseReport = {
      ...report,
      classifier_label: triage.label,
      classifier_confidence: triage.confidence,
      status: triage.reportStatus,
      automation_state: triage.automationState,
    };

    if (triage.decision === "auto_action") {
      const nextPostStatus = triage.action === "remove_root" ? "removed" : "hidden";
      const nextMetadata = {
        ...(post.metadata ?? {}),
        moderation_reason: triage.label,
        moderation_source: "deterministic_bot",
      };
      const now = new Date().toISOString();

      const [{ error: postUpdateError }, { error: reportUpdateError }] = await Promise.all([
        admin
          .from("social_posts")
          .update({
            status: nextPostStatus,
            metadata: nextMetadata,
            updated_at: now,
          })
          .eq("id", post.id),
        admin
          .from("social_post_reports")
          .update({
            classifier_label: triage.label,
            classifier_confidence: triage.confidence,
            status: triage.reportStatus,
            automation_state: triage.automationState,
            resolution_notes: "Auto actioned by deterministic moderation triage.",
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
              "Failed to auto-action report",
          },
          { status: 500 }
        );
      }
    } else if (triage.decision === "needs_admin_review") {
      const now = new Date().toISOString();
      const { error: reportUpdateError } = await admin
        .from("social_post_reports")
        .update({
          classifier_label: triage.label,
          classifier_confidence: triage.confidence,
          status: triage.reportStatus,
          automation_state: triage.automationState,
          updated_at: now,
        })
        .eq("id", report.id);

      if (reportUpdateError) {
        return NextResponse.json({ error: reportUpdateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ report: responseReport }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "api/social/posts/report");
  }
}
