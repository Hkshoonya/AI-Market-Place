import { runScheduledAgentCron } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runScheduledAgentCron(request, {
    agentSlug: "verifier",
    jobName: "agent-verifier",
  });
}
