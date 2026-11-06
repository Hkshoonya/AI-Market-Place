import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parquetMetadata, parquetReadObjects, type FileMetaData } from "hyparquet";
import { fetchOfficialArenaSnapshot, parseOfficialArenaRow, planOfficialArenaImport } from "./official-arena";

vi.mock("hyparquet", () => ({ parquetMetadata: vi.fn(), parquetReadObjects: vi.fn() }));
const revision = "a".repeat(40);
const bytes = new TextEncoder().encode("PAR1synthetic-fixturePAR1");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const now = Date.parse("2026-11-06T12:00:00Z");
const row = { model_name: "Example 2 (High)", organization: "Example", category: "overall", rating: 1540.2,
  rating_lower: 1530.7, rating_upper: 1549.3, vote_count: 4403n, rank: 1n, leaderboard_publish_date: "2026-10-28" };
const fields = Object.keys(row);
const manifest = (change = {}) => [{ type: "file", path: "text/latest-00000-of-00001.parquet",
  size: bytes.length, lfs: { oid: sha256 }, ...change }];
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: URL) => {
    if (String(url).endsWith("/revision/main")) return Response.json({ sha: revision });
    if (String(url).includes("/tree/")) return Response.json(manifest());
    return new Response(bytes);
  });
  vi.mocked(parquetMetadata).mockReturnValue({ num_rows: 1n, row_groups: [{ total_byte_size: 128n }],
    schema: fields.map((name) => ({ name })) } as FileMetaData);
  vi.mocked(parquetReadObjects).mockResolvedValue([row]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("official Arena snapshots", () => {
  it("uses an immutable official snapshot and validates its hash, schema and publication", async () => {
    const result = await fetchOfficialArenaSnapshot("text");
    expect(result).toMatchObject({ revision, sha256, publicationDate: "2026-10-28", bytes: bytes.length });
    expect(result.rows[0]).toMatchObject({ votes: 4403, rank: 1, eloScore: 1540, confidenceLow: 1530, confidenceHigh: 1550 });
    expect(String(fetchMock.mock.calls[2][0])).toContain(`/resolve/${revision}/text/latest-`);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.credentials).toBe("omit");
      expect(init.redirect).toBe("manual");
      expect(init.headers).not.toHaveProperty("Authorization");
    }
  });

  it("keeps unknown organizations visible but cannot attribute them to a catalog provider", () => {
    const parsed = parseOfficialArenaRow({ ...row, organization: "" }, now)!;
    expect(parsed.organization).toBeNull();
    expect(planOfficialArenaImport("text", [parsed], [{ id: "m", name: row.model_name, slug: "example-2-high", provider: "Example" }]).ratings).toEqual([]);
  });

  it.each([{ rating: NaN }, { rating: Infinity }, { rating: "1540" }, { rating: -1 },
    { category: "coding" }, { leaderboard_publish_date: "2025-07-18" },
    { leaderboard_publish_date: "2099-01-01" }, { leaderboard_publish_date: "2026-02-30" }])("rejects invalid evidence: %j", (change) => {
    expect(parseOfficialArenaRow({ ...row, ...change }, now)).toBeNull();
  });

  it("fails integrity checks before decoding a changed download", async () => {
    fetchMock.mockImplementationOnce(async () => Response.json({ sha: revision }))
      .mockImplementationOnce(async () => Response.json(manifest()))
      .mockImplementationOnce(async () => new Response("tampered"));
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("integrity");
    expect(parquetReadObjects).not.toHaveBeenCalled();
  });

  it("rejects oversized manifests, wrong paths and invalid revisions", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ sha: "main" }));
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("revision");
    fetchMock.mockResolvedValueOnce(Response.json({ sha: revision }))
      .mockResolvedValueOnce(Response.json(manifest({ size: 3 * 1024 * 1024 })));
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("oversized");
    fetchMock.mockResolvedValueOnce(Response.json({ sha: revision }))
      .mockResolvedValueOnce(Response.json(manifest({ path: "agent/latest-00000-of-00001.parquet" })));
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("Missing");
  });

  it("rejects redirects outside fixed HTTPS publisher/CDN hosts", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("Untrusted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds downloads even if the declared content length is missing", async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(257 * 1024)));
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("size limit");
  });

  it("rejects oversized decoded metadata and mixed publications", async () => {
    vi.mocked(parquetMetadata).mockReturnValueOnce({ num_rows: 20001n, row_groups: [], schema: [] } as unknown as FileMetaData);
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("row budget");
    vi.mocked(parquetReadObjects).mockResolvedValueOnce([row, { ...row, leaderboard_publish_date: "2026-10-27" }]);
    await expect(fetchOfficialArenaSnapshot("text")).rejects.toThrow("mixed-date");
  });

  it("requires exact version, effort option and provider without dated-family inheritance", () => {
    const models = [
      { id: "correct", name: "Example 2 (High)", slug: "example-2-high", provider: "Example" },
      { id: "wrong-provider", name: "Example 2 (High)", slug: "other-example-2-high", provider: "Other" },
      { id: "bare", name: "Example 2", slug: "example-2", provider: "Example" },
      { id: "dated", name: "Example 2 2026-10-01", slug: "example-2-2026-10-01", provider: "Example" },
    ];
    const plan = planOfficialArenaImport("text", [parseOfficialArenaRow(row, now)!], models);
    expect(plan.ratings.map((rating) => rating.model_id)).toEqual(["correct"]);
    const bare = planOfficialArenaImport("text", [parseOfficialArenaRow({ ...row, model_name: "Example 2 (Extended)" }, now)!], models);
    expect(bare.ratings).toEqual([]);
  });
});
