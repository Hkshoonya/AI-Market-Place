import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSocialActorFromRequest } from "@/lib/social/auth";
import { canActorReplyToThread } from "@/lib/social/actors";
import { SocialImageAttachmentListSchema, insertSocialPostImages } from "@/lib/social/media";

const ReplySchema = z.object({
  content: z.string().trim().min(1).max(5000),
  language_code: z.string().trim().min(2).max(12).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  images: SocialImageAttachmentListSchema.optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveSocialActorFromRequest(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = ReplySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: parentPost, error: parentError } = await admin
    .from("social_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (parentError) {
    return NextResponse.json({ error: parentError.message }, { status: 500 });
  }
  if (!parentPost) {
    return NextResponse.json({ error: "Parent post not found" }, { status: 404 });
  }

  const permission = await canActorReplyToThread(admin, parentPost.thread_id, actor.actor.id);
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason ?? "Blocked" }, { status: 403 });
  }

  const { data: thread, error: threadError } = await admin
    .from("social_threads")
    .select("id, reply_count")
    .eq("id", parentPost.thread_id)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: reply, error: replyError } = await admin
    .from("social_posts")
    .insert({
      thread_id: parentPost.thread_id,
      parent_post_id: parentPost.id,
      author_actor_id: actor.actor.id,
      community_id: parentPost.community_id ?? null,
      content: parsed.data.content,
      language_code: parsed.data.language_code ?? null,
      status: "published",
      reply_count: 0,
      metadata: parsed.data.metadata ?? {},
    })
    .select("*")
    .single();

  if (replyError || !reply) {
    return NextResponse.json(
      { error: replyError?.message ?? "Failed to create reply" },
      { status: 500 }
    );
  }

  await insertSocialPostImages(admin, reply.id, parsed.data.images);

  const now = new Date().toISOString();
  const [{ error: parentUpdateError }, { error: threadUpdateError }] = await Promise.all([
    admin
      .from("social_posts")
      .update({
        reply_count: (parentPost.reply_count ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", parentPost.id),
    admin
      .from("social_threads")
      .update({
        reply_count: (thread.reply_count ?? 0) + 1,
        last_posted_at: now,
        updated_at: now,
      })
      .eq("id", parentPost.thread_id),
  ]);

  if (parentUpdateError || threadUpdateError) {
    return NextResponse.json(
      { error: parentUpdateError?.message ?? threadUpdateError?.message ?? "Failed to update thread" },
      { status: 500 }
    );
  }

  return NextResponse.json({ reply }, { status: 201 });
}
