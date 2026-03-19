import { runScheduledAgentCron } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  return runScheduledAgentCron(request, {
    agentSlug: "pipeline-engineer",
    jobName: "agent-pipeline-engineer",
  });
}
