import { runScheduledAgentCron } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 900; // 15 minutes

const PIPELINE_ENGINEER_TIMEOUT_MS = 840_000; // 14 minutes

export async function GET(request: Request) {
  return runScheduledAgentCron(request, {
    agentSlug: "pipeline-engineer",
    jobName: "agent-pipeline-engineer",
    timeoutMs: PIPELINE_ENGINEER_TIMEOUT_MS,
  });
}
