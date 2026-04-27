import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  modelId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateCommentSchema = z.object({
  modelId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(5000),
  parentId: z.string().trim().min(1).nullable().optional(),
});

const UpdateCommentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upvote"),
    commentId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("edit"),
    commentId: z.string().trim().min(1),
    content: z.string().trim().min(1).max(5000),
  }),
]);

const DeleteCommentSchema = z.object({
  commentId: z.string().trim().min(1),
});

interface CommentRow {
  id: string;
  content: string;
  upvotes: number;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  user_id: string;
  model_id: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

async function loadComments(modelId: string, limit: number) {
  const admin = createAdminClient();

  const { data: topLevelRows, error: topLevelError } = await admin
    .from("comments")
    .select("id, content, upvotes, created_at, updated_at, parent_id, user_id, model_id")
    .eq("model_id", modelId)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (topLevelError) {
    throw topLevelError;
  }

  const topLevel = (topLevelRows ?? []) as CommentRow[];
  const topLevelIds = topLevel.map((comment) => comment.id);

  const { data: replyRows, error: repliesError } =
    topLevelIds.length > 0
      ? await admin
          .from("comments")
          .select("id, content, upvotes, created_at, updated_at, parent_id, user_id, model_id")
          .in("parent_id", topLevelIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  if (repliesError) {
    throw repliesError;
  }

  const allComments = [...topLevel, ...((replyRows ?? []) as CommentRow[])];
  const userIds = [...new Set(allComments.map((comment) => comment.user_id).filter(Boolean))];

  const { data: profiles, error: profileError } =
    userIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, display_name, avatar_url, username")
          .in("id", userIds)
      : { data: [], error: null };

  if (profileError) {
    throw profileError;
  }

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const replyMap = new Map<string, Array<CommentRow & { profiles: ProfileRow | null }>>();

  for (const reply of (replyRows ?? []) as CommentRow[]) {
    const existing = replyMap.get(reply.parent_id!) ?? [];
    existing.push({
      ...reply,
      profiles: profileMap.get(reply.user_id) ?? null,
    });
    replyMap.set(reply.parent_id!, existing);
  }

  return topLevel.map((comment) => ({
    ...comment,
    profiles: profileMap.get(comment.user_id) ?? null,
    replies: replyMap.get(comment.id) ?? [],
  }));
}

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({
    modelId: request.nextUrl.searchParams.get("modelId"),
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const comments = await loadComments(parsed.data.modelId, parsed.data.limit);
    return NextResponse.json({ comments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load comments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = rejectUntrustedRequestOrigin(request);
  if (originError) {
    return originError;
  }

  const parsed = CreateCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: insertedComment, error: insertError } = await admin
    .from("comments")
    .insert({
      model_id: parsed.data.modelId,
      user_id: user.id,
      content: parsed.data.content,
      parent_id: parsed.data.parentId ?? null,
    })
    .select("id, content, upvotes, created_at, updated_at, parent_id, user_id, model_id")
    .single();

  if (insertError || !insertedComment) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create comment" },
      { status: 500 }
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url, username")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      comment: {
        ...insertedComment,
        profiles: profile
          ? {
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              username: profile.username,
            }
          : null,
        replies: [],
      },
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = rejectUntrustedRequestOrigin(request);
  if (originError) {
    return originError;
  }

  const parsed = UpdateCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  if (parsed.data.action === "upvote") {
    // Supabase generated RPC typings lag this deployed function.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.rpc as any)("increment_comment_upvote", {
      comment_id: parsed.data.commentId,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to upvote comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  const { data: updatedComment, error: updateError } = await admin
    .from("comments")
    .update({ content: parsed.data.content })
    .eq("id", parsed.data.commentId)
    .eq("user_id", user.id)
    .select("id, content, upvotes, created_at, updated_at, parent_id, user_id, model_id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update comment" },
      { status: 500 }
    );
  }

  if (!updatedComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  return NextResponse.json({ comment: updatedComment });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originError = rejectUntrustedRequestOrigin(request);
  if (originError) {
    return originError;
  }

  const parsed = DeleteCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("comments")
    .delete()
    .eq("id", parsed.data.commentId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to delete comment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
