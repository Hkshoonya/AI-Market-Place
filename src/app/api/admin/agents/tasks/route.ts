import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { extractAgentTaskModelMetadata } from "@/lib/agents/task-model-metadata";

export const dynamic = "force-dynamic";

// GET /api/admin/agents/tasks — list recent agent tasks
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-agent-tasks:${ip}`, RATE_LIMITS.public);
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

    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*, agents:agent_id(name, slug)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tasks = (data ?? []).map((task) => {
      const taskRow = task as Record<string, unknown> & { output?: unknown };
      return {
        ...taskRow,
        llm: extractAgentTaskModelMetadata(taskRow.output),
      };
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    return handleApiError(err, "api/admin/agents/tasks");
  }
}
