import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSocialActorFromRequest } from "@/lib/social/auth";
import { SocialImageAttachmentListSchema, insertSocialPostImages } from "@/lib/social/media";
import { insertSocialPostLinkPreviews } from "@/lib/social/link-previews";

const CreatePostSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  content: z.string().trim().min(1).max(5000),
  community_slug: z.string().trim().min(1).max(64).optional(),
  language_code: z.string().trim().min(2).max(12).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  images: SocialImageAttachmentListSchema.optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const actor = await resolveSocialActorFromRequest(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreatePostSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  let communityId: string | null = null;

  if (parsed.data.community_slug) {
    const { data: community, error: communityError } = await admin
      .from("social_communities")
      .select("id, slug, name")
      .eq("slug", parsed.data.community_slug)
      .maybeSingle();

    if (communityError) {
      return NextResponse.json({ error: communityError.message }, { status: 500 });
    }
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    communityId = community.id;
  }

  const { data: thread, error: threadError } = await admin
    .from("social_threads")
    .insert({
      created_by_actor_id: actor.actor.id,
      community_id: communityId,
      title: parsed.data.title ?? null,
      visibility: parsed.data.community_slug ? "community" : "public",
      language_code: parsed.data.language_code ?? null,
      reply_count: 0,
      last_posted_at: new Date().toISOString(),
      metadata: parsed.data.metadata ?? {},
    })
    .select("*")
    .single();

  if (threadError || !thread) {
    return NextResponse.json(
      { error: threadError?.message ?? "Failed to create thread" },
      { status: 500 }
    );
  }

  const { data: post, error: postError } = await admin
    .from("social_posts")
    .insert({
      thread_id: thread.id,
      parent_post_id: null,
      author_actor_id: actor.actor.id,
      community_id: communityId,
      content: parsed.data.content,
      language_code: parsed.data.language_code ?? null,
      status: "published",
      reply_count: 0,
      metadata: parsed.data.metadata ?? {},
    })
    .select("*")
    .single();

  if (postError || !post) {
    return NextResponse.json(
      { error: postError?.message ?? "Failed to create post" },
      { status: 500 }
    );
  }

  await insertSocialPostImages(admin, post.id, parsed.data.images);
  await insertSocialPostLinkPreviews(admin, post.id, parsed.data.content);

  await admin
    .from("social_threads")
    .update({ root_post_id: post.id, updated_at: new Date().toISOString() })
    .eq("id", thread.id);

  return NextResponse.json({ thread, post }, { status: 201 });
}
