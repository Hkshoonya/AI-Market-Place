import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSocialActorFromRequest } from "@/lib/social/auth";
import { rejectUntrustedSessionOrigin } from "@/lib/security/request-origin";
import { RATE_LIMITS, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const BlockSchema = z.object({
  blocked_actor_id: z.string().uuid().or(z.string().min(1)),
  reason: z.enum(["thread_owner_block", "spam", "abuse"]).optional(),
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

  const originError = rejectUntrustedSessionOrigin(request, actor.authMethod);
  if (originError) {
    return originError;
  }

  if (actor.actor.actor_type !== "human") {
    return NextResponse.json(
      { error: "Only human thread owners can block actors." },
      { status: 403 }
    );
  }

  const writeLimit = await rateLimit(
    `social-write:${actor.actor.id}`,
    RATE_LIMITS.socialWrite
  );
  if (!writeLimit.success) {
    return NextResponse.json(
      { error: "Too many social moderation actions. Please wait and try again." },
      { status: 429, headers: rateLimitHeaders(writeLimit) }
    );
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: thread, error: threadError } = await admin
    .from("social_threads")
    .select("id, created_by_actor_id")
    .eq("id", id)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  if (thread.created_by_actor_id !== actor.actor.id) {
    return NextResponse.json(
      { error: "Only the thread owner can block actors in this thread." },
      { status: 403 }
    );
  }

  const { data: blockedActor, error: actorError } = await admin
    .from("network_actors")
    .select("id, actor_type")
    .eq("id", parsed.data.blocked_actor_id)
    .maybeSingle();

  if (actorError) {
    return NextResponse.json({ error: actorError.message }, { status: 500 });
  }
  if (!blockedActor) {
    return NextResponse.json({ error: "Blocked actor not found" }, { status: 404 });
  }
  if (blockedActor.actor_type === "human") {
    return NextResponse.json(
      { error: "Human actors cannot be blocked in threads." },
      { status: 400 }
    );
  }

  const { data: block, error: blockError } = await admin
    .from("social_thread_blocks")
    .insert({
      thread_id: id,
      blocked_actor_id: parsed.data.blocked_actor_id,
      blocked_by_actor_id: actor.actor.id,
      reason: parsed.data.reason ?? "thread_owner_block",
    })
    .select("*")
    .single();

  if (blockError || !block) {
    return NextResponse.json(
      { error: blockError?.message ?? "Failed to create block" },
      { status: 500 }
    );
  }

  return NextResponse.json({ block }, { status: 201 });
}
