import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockExecuteAgent = vi.fn();
const mockTrackerComplete = vi.fn();
const mockTrackerFail = vi.fn();
const mockTrackerSkip = vi.fn();
const mockTrackCronRun = vi.fn().mockResolvedValue({
  complete: (...args: unknown[]) => mockTrackerComplete(...args),
  fail: (...args: unknown[]) => mockTrackerFail(...args),
  skip: (...args: unknown[]) => mockTrackerSkip(...args),
  runId: "cron-run-1",
  shouldSkip: false,
});

vi.mock("@/lib/agents/runtime", () => ({
  executeAgent: (...args: unknown[]) => mockExecuteAgent(...args),
}));

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

describe("runScheduledAgentCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockTrackerComplete.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, ...data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    mockTrackerFail.mockImplementation((error: Error) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    mockTrackerSkip.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 500 through the tracker when the agent reports failure", async () => {
    mockExecuteAgent.mockResolvedValue({
      agentSlug: "pipeline-engineer",
      taskId: "task-1",
      success: false,
      output: {},
      errors: ["adapter health check failed"],
      durationMs: 123,
    });

    const { runScheduledAgentCron } = await import("./_shared");
    const response = await runScheduledAgentCron(
      new Request("https://aimarketcap.tech/api/cron/agents/pipeline", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
      { agentSlug: "pipeline-engineer", jobName: "agent-pipeline-engineer" }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/pipeline-engineer failed/i);
    expect(mockTrackerFail).toHaveBeenCalledTimes(1);
    expect(mockTrackerComplete).not.toHaveBeenCalled();
  });

  it("returns 200 through the tracker when the agent succeeds", async () => {
    mockExecuteAgent.mockResolvedValue({
      agentSlug: "verifier",
      taskId: "task-2",
      success: true,
      output: { issuesScanned: 3 },
      errors: [],
      durationMs: 88,
    });

    const { runScheduledAgentCron } = await import("./_shared");
    const response = await runScheduledAgentCron(
      new Request("https://aimarketcap.tech/api/cron/agents/verifier", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
      { agentSlug: "verifier", jobName: "agent-verifier" }
    );

    expect(response.status).toBe(200);
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "verifier",
        success: true,
        durationMs: 88,
      })
    );
  });

  it("treats an already-running agent task as a skipped completion instead of a cron failure", async () => {
    mockExecuteAgent.mockResolvedValue({
      agentSlug: "pipeline-engineer",
      taskId: "task-running",
      success: false,
      skipped: true,
      output: { skippedReason: "agent_run_already_in_progress" },
      errors: ["Agent \"pipeline-engineer\" already has a running task in progress."],
      durationMs: 9,
    });

    const { runScheduledAgentCron } = await import("./_shared");
    const response = await runScheduledAgentCron(
      new Request("https://aimarketcap.tech/api/cron/agents/pipeline", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
      { agentSlug: "pipeline-engineer", jobName: "agent-pipeline-engineer" }
    );

    expect(response.status).toBe(200);
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        skipped: true,
        taskId: "task-running",
      })
    );
    expect(mockTrackerFail).not.toHaveBeenCalled();
  });
});
