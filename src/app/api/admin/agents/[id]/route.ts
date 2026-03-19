import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { executeAgent } from "@/lib/agents/runtime";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// PATCH /api/admin/agents/[id] — update agent status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-agents-write:${ip}`, RATE_LIMITS.write);
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const { status } = body as { status: string };

    if (!["active", "paused", "disabled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data: existingAgent } = await supabase
      .from("agents")
      .select("status, error_count")
      .eq("id", id)
      .single();

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const updates: {
      status: "active" | "paused" | "disabled";
      updated_at: string;
      error_count?: number;
    } = {
      status: status as "active" | "paused" | "disabled",
      updated_at: new Date().toISOString(),
    };

    if (
      status === "active" &&
      existingAgent.status !== "active" &&
      Number(existingAgent.error_count ?? 0) > 0
    ) {
      updates.error_count = 0;
    }

    const { error } = await supabase
      .from("agents")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "api/admin/agents");
  }
}

// POST /api/admin/agents/[id] — trigger agent execution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-agents-trigger:${ip}`, RATE_LIMITS.write);
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

    // Look up agent slug by id
    const { data: agent } = await supabase
      .from("agents")
      .select("slug, status")
      .eq("id", id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Agent must be active before it can be triggered manually. Resume it first from admin controls.",
        },
        { status: 409 }
      );
    }

    const result = await executeAgent(agent.slug, "manual_trigger");

    if (result.skipped) {
      return NextResponse.json(
        {
          success: false,
          agent: result.agentSlug,
          taskId: result.taskId,
          durationMs: result.durationMs,
          output: result.output,
          errors: result.errors,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: result.success,
      agent: result.agentSlug,
      taskId: result.taskId,
      durationMs: result.durationMs,
      output: result.output,
      errors: result.errors,
    });
  } catch (err) {
    return handleApiError(err, "api/admin/agents");
  }
}
