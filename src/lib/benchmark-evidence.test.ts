import { describe, expect, it, vi } from "vitest";
import { fetchBenchmarkEvidenceRows } from "./benchmark-evidence";

describe("fetchBenchmarkEvidenceRows", () => {
  it("retrieves all evidence in one request, including more than 1000 model IDs", async () => {
    const ids = Array.from({ length: 3500 }, (_, id) => `model-${id}`);
    const rpc = vi.fn().mockResolvedValue({ data: ids, error: null });
    expect(await fetchBenchmarkEvidenceRows({ rpc })).toEqual([{ related_model_ids: ids }]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_benchmark_evidence_model_ids");
  });

  it("accepts an empty summary", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    expect(await fetchBenchmarkEvidenceRows({ rpc })).toEqual([{ related_model_ids: [] }]);
  });

  it("shares simultaneous audits but refreshes on the next run", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ["first"], error: null });
    const client = { rpc };
    const [left, right] = await Promise.all([
      fetchBenchmarkEvidenceRows(client),
      fetchBenchmarkEvidenceRows(client),
    ]);
    expect(left).toEqual(right);
    expect(rpc).toHaveBeenCalledTimes(1);
    rpc.mockResolvedValue({ data: ["new-evidence"], error: null });
    expect(await fetchBenchmarkEvidenceRows(client)).toEqual([{ related_model_ids: ["new-evidence"] }]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("never shares evidence between different clients", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await Promise.all([fetchBenchmarkEvidenceRows({ rpc }), fetchBenchmarkEvidenceRows({ rpc })]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("clears rejected requests so a later audit can recover", async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValue({ data: [], error: null });
    const client = { rpc };
    await expect(fetchBenchmarkEvidenceRows(client)).rejects.toThrow("network failed");
    expect(await fetchBenchmarkEvidenceRows(client)).toEqual([{ related_model_ids: [] }]);
  });

  it("does not silently fall back to expensive scans when the migration is missing", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "function missing" } });
    await expect(fetchBenchmarkEvidenceRows({ rpc })).rejects.toThrow("function missing");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, [null], [1]])("rejects malformed evidence rather than reporting false coverage: %j", async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    await expect(fetchBenchmarkEvidenceRows({ rpc })).rejects.toThrow("Invalid benchmark evidence summary");
  });
});
