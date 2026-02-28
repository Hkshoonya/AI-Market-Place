import { NextResponse } from "next/server";
import { executeAgent } from "@/lib/agents/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeAgent("ux-monitor", "scheduled_run");

    return NextResponse.json({
      agent: result.agentSlug,
      taskId: result.taskId,
      success: result.success,
      durationMs: result.durationMs,
      output: result.output,
      errors: result.errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent execution failed" },
      { status: 500 }
    );
  }
}
