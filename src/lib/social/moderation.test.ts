import { describe, expect, it } from "vitest";

describe("social moderation triage", () => {
  it("auto-actions obvious spam and scam promotion", async () => {
    const { triageSocialPostReport } = await import("./moderation");

    const result = triageSocialPostReport({
      reason: "spam",
      content: "DM for guaranteed profit 100x now. Airdrop now. Scam link repeated.",
      details: "Repeated scam links and guaranteed profit claims",
      isRootPost: true,
    });

    expect(result.decision).toBe("auto_action");
    expect(result.action).toBe("remove_root");
    expect(result.label).toBe("spam");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("auto-actions obvious malware or credential theft promotion", async () => {
    const { triageSocialPostReport } = await import("./moderation");

    const result = triageSocialPostReport({
      reason: "malware",
      content: "Download this password stealer and token drainer builder now.",
      details: "Password stealer dropper",
      isRootPost: false,
    });

    expect(result.decision).toBe("auto_action");
    expect(result.action).toBe("hide_reply");
    expect(result.label).toBe("malware");
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("sends ambiguous harassment cases to admin review", async () => {
    const { triageSocialPostReport } = await import("./moderation");

    const result = triageSocialPostReport({
      reason: "abuse",
      content: "You are trash and should disappear.",
      details: "Hostile but not clearly a slur or direct threat",
      isRootPost: true,
    });

    expect(result.decision).toBe("needs_admin_review");
    expect(result.action).toBeNull();
    expect(result.label).toBe("abuse");
  });

  it("leaves low-confidence reports open without auto action", async () => {
    const { triageSocialPostReport } = await import("./moderation");

    const result = triageSocialPostReport({
      reason: "other",
      content: "I disagree with this benchmark take.",
      details: "I just do not like this post",
      isRootPost: true,
    });

    expect(result.decision).toBe("no_action");
    expect(result.action).toBeNull();
    expect(result.label).toBe("other");
  });
});
