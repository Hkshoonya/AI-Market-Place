import { describe, expect, it } from "vitest";
import { selectArenaEvidence, type ArenaSnapshot } from "./arena-evidence";

const now = Date.parse("2026-11-06T12:00:00Z");
const row = (model_id: string, elo_score: number, snapshot_date = "2026-11-06", arena_name = "arena-text-official"): ArenaSnapshot => ({
  model_id, elo_score, snapshot_date, arena_name,
});

describe("selectArenaEvidence", () => {
  it("uses the latest snapshot, not a historical peak, independently of input order", () => {
    const snapshots = [row("a", 1500, "2026-10-01"), row("a", 1250)];
    const models = [{ id: "a", category: "llm" }];
    expect(selectArenaEvidence(snapshots, models, now).eloMap.get("a")).toBe(1250);
    expect(selectArenaEvidence(snapshots.reverse(), models, now).eloMap.get("a")).toBe(1250);
  });

  it("keeps leading ratings distinct above 1400 and isolates arena scales", () => {
    const models = ["a", "b", "c"].map((id) => ({ id, category: "multimodal" }));
    const result = selectArenaEvidence([row("a", 1450), row("b", 1474), row("c", 1400, "2026-11-06", "arena-vision-official")], models, now);
    expect(result.eloNormalizedMap.get("a")).toBeLessThan(result.eloNormalizedMap.get("b")!);
    expect(result.eloNormalizedMap.get("b")).toBe(100);
    expect(result.eloNormalizedMap.get("c")).toBe(100);
  });

  it("never takes a larger rating from an unrelated arena or frozen legacy mirror", () => {
    const result = selectArenaEvidence([row("a", 1200), row("a", 1300, "2026-11-06", "arena-vision-official"), row("a", 1500, "2026-11-06", "chatbot-arena")], [{ id: "a", category: "multimodal" }], now);
    expect(result.eloMap.get("a")).toBe(1200);
    expect([...result.eloSourcesByModel.get("a")!]).toEqual(["arena-text-official"]);
  });

  it("rejects malformed, future, non-finite, inactive-model and unknown-arena evidence", () => {
    const result = selectArenaEvidence([row("a", NaN), row("a", Infinity), row("a", 0),
      row("a", 1600, "2099-01-01"), row("a", 1600, "invalid"), row("inactive", 2000),
      row("a", 1600, "2026-11-06", "unknown"), row("a", 1600, "2026-11-06", "arena-vision-official")], [{ id: "a", category: "llm" }], now);
    expect(result.eloMap.size).toBe(0);
  });

  it("does not use image-understanding or text ratings for image-generation models", () => {
    expect(selectArenaEvidence([row("a", 1300), row("a", 1400, "2026-11-06", "arena-vision-official")], [{ id: "a", category: "image_generation" }], now).eloMap.size).toBe(0);
  });

  it("uses vision ratings for the dedicated image-understanding category", () => {
    const result = selectArenaEvidence([row("a", 1400), row("a", 1200, "2026-11-06", "arena-vision-official")], [{ id: "a", category: "vision" }], now);
    expect(result.eloMap.get("a")).toBe(1200);
  });
});
