import { describe, expect, it } from "vitest";

describe("social moderation schemas", () => {
  it("parses social post report rows with moderation metadata", async () => {
    const { SocialPostReportSchema } = await import("./social");

    const parsed = SocialPostReportSchema.parse({
      id: "report-1",
      post_id: "post-1",
      thread_id: "thread-1",
      reporter_actor_id: "actor-1",
      target_actor_id: "actor-2",
      reason: "spam",
      details: "Repeated scam links",
      status: "open",
      automation_state: "pending",
      classifier_label: null,
      classifier_confidence: null,
      resolved_by_actor_id: null,
      resolved_at: null,
      resolution_notes: null,
      created_at: "2026-03-13T00:00:00.000Z",
      updated_at: "2026-03-13T00:00:00.000Z",
    });

    expect(parsed.reason).toBe("spam");
    expect(parsed.automation_state).toBe("pending");
  });
});
