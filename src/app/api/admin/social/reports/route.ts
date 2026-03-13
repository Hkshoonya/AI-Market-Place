import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import {
  getClientIp,
  RATE_LIMITS,
  rateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-social-reports:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const auth = await requireAdminSession();
    if ("error" in auth) return auth.error;

    const admin = createAdminClient();
    const { data: reports, error: reportError } = await admin
      .from("social_post_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    const postIds = [...new Set((reports ?? []).map((report) => report.post_id))];
    const threadIds = [...new Set((reports ?? []).map((report) => report.thread_id))];
    const actorIds = [
      ...new Set(
        (reports ?? [])
          .flatMap((report) => [report.reporter_actor_id, report.target_actor_id])
          .filter((value): value is string => Boolean(value))
      ),
    ];

    const [postsResult, threadsResult, actorsResult] = await Promise.all([
      postIds.length > 0
        ? admin.from("social_posts").select("*").in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      threadIds.length > 0
        ? admin.from("social_threads").select("*").in("id", threadIds)
        : Promise.resolve({ data: [], error: null }),
      actorIds.length > 0
        ? admin.from("network_actors").select("*").in("id", actorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (postsResult.error) {
      return NextResponse.json({ error: postsResult.error.message }, { status: 500 });
    }
    if (threadsResult.error) {
      return NextResponse.json({ error: threadsResult.error.message }, { status: 500 });
    }
    if (actorsResult.error) {
      return NextResponse.json({ error: actorsResult.error.message }, { status: 500 });
    }

    const postMap = new Map((postsResult.data ?? []).map((post) => [post.id, post]));
    const threadMap = new Map((threadsResult.data ?? []).map((thread) => [thread.id, thread]));
    const actorMap = new Map((actorsResult.data ?? []).map((actor) => [actor.id, actor]));

    return NextResponse.json({
      reports: (reports ?? []).map((report) => ({
        ...report,
        post: postMap.get(report.post_id) ?? null,
        thread: threadMap.get(report.thread_id) ?? null,
        reporter: actorMap.get(report.reporter_actor_id) ?? null,
        target: report.target_actor_id ? (actorMap.get(report.target_actor_id) ?? null) : null,
      })),
    });
  } catch (error) {
    return handleApiError(error, "api/admin/social/reports");
  }
}
