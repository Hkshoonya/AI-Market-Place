import { NextResponse } from "next/server";
import { executeAgent } from "@/lib/agents/runtime";
import { trackCronRun } from "@/lib/cron-tracker";

export async function runScheduledAgentCron(
  request: Request,
  options: {
    agentSlug: string;
    jobName: string;
  }
) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracker = await trackCronRun(options.jobName);
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  const result = await executeAgent(options.agentSlug, "scheduled_run");
  const payload = {
    agent: result.agentSlug,
    taskId: result.taskId,
    success: result.success,
    durationMs: result.durationMs,
    output: result.output,
    errors: result.errors,
  };

  if (!result.success) {
    return tracker.fail(
      new Error(
        `Scheduled agent ${result.agentSlug} failed: ${result.errors.join("; ") || "unknown error"}`
      )
    );
  }

  return tracker.complete(payload);
}
