import { describe, expect, it, vi } from "vitest";
import { __testables } from "./openai-models";

describe("OpenAI model API enrichment", () => {
  it("converts provider creation timestamps to release dates", () => {
    const timestamp = Date.UTC(2026, 6, 27, 18, 30) / 1000;

    expect(__testables.releaseDateFromUnixSeconds(timestamp)).toBe("2026-07-27");
    expect(__testables.releaseDateFromUnixSeconds(0)).toBeNull();
    expect(__testables.releaseDateFromUnixSeconds(Number.NaN)).toBeNull();
  });

  it("adds API-only models with their provider creation date", () => {
    const records = new Map<string, Record<string, unknown>>();
    const buildRecord = vi.fn(
      (modelId: string, overrides?: { release_date?: string }) => ({
        model_id: modelId,
        release_date: overrides?.release_date ?? null,
      })
    );

    __testables.enrichFromApi(
      records,
      new Map([
        ["gpt-new-model", { releaseDate: "2026-07-27" }],
      ]),
      "2026-07-30T12:00:00.000Z",
      buildRecord
    );

    expect(buildRecord).toHaveBeenCalledWith("gpt-new-model", {
      release_date: "2026-07-27",
    });
    expect(records.get("gpt-new-model")).toMatchObject({
      release_date: "2026-07-27",
      data_refreshed_at: "2026-07-30T12:00:00.000Z",
    });
  });

  it("does not replace a curated release date", () => {
    const records = new Map<string, Record<string, unknown>>([
      ["gpt-5.6-sol", { release_date: "2026-07-09" }],
    ]);

    __testables.enrichFromApi(
      records,
      new Map([
        ["gpt-5.6-sol", { releaseDate: "2026-06-23" }],
      ]),
      "2026-07-30T12:00:00.000Z",
      vi.fn()
    );

    expect(records.get("gpt-5.6-sol")?.release_date).toBe("2026-07-09");
  });
});
