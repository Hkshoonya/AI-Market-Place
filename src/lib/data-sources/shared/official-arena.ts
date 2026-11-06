import { createHash } from "node:crypto";
import { parquetMetadata, parquetReadObjects } from "hyparquet";
import { buildModelAliasIndex, resolveAliasFamilyModelIds } from "../model-alias-resolver";
import { makeSlug } from "../utils";
import { getCanonicalProviderName, normalizeProviderKey } from "@/lib/constants/providers";

export const ARENA_DATASET = "lmarena-ai/leaderboard-dataset";
export type ArenaSubset = "text" | "vision";
export const OFFICIAL_ARENAS = { text: "arena-text-official", vision: "arena-vision-official" } as const;
const HUB = `https://huggingface.co/api/datasets/${ARENA_DATASET}`;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 20_000;
const MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const COLUMNS = ["model_name", "organization", "rating", "rating_lower", "rating_upper", "vote_count", "rank", "category", "leaderboard_publish_date"];

export interface OfficialArenaRow {
  modelName: string;
  organization: string | null;
  snapshotDate: string;
  eloScore: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  votes: number | null;
  rank: number | null;
}

async function boundedBody(response: Response, limit: number) {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!Number.isSafeInteger(Number(declared)) || Number(declared) < 0 || Number(declared) > limit)) {
    await response.body?.cancel();
    throw new Error("Arena response exceeds the size limit");
  }
  if (!response.body) throw new Error("Empty Arena response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Arena response exceeds the size limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Public downloads never carry account credentials, including across redirects. */
async function publicDownload(url: string, limit: number, signal: AbortSignal) {
  let target = new URL(url);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const allowedHost = target.hostname === "huggingface.co"
      || target.hostname.endsWith(".huggingface.co") || target.hostname.endsWith(".hf.co");
    if (!allowedHost || target.protocol !== "https:" || target.port || target.username || target.password) {
      throw new Error("Untrusted Arena download destination");
    }
    const response = await fetch(target, { signal, redirect: "manual", credentials: "omit",
      headers: { Accept: "application/octet-stream,application/json", "User-Agent": "AI-Market-Cap-Bot" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Arena redirect is missing a destination");
      target = new URL(location, target);
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Official Arena repository returned HTTP ${response.status}`); }
    return boundedBody(response, limit);
  }
  throw new Error("Too many Arena download redirects");
}

function optionalInteger(value: unknown, rounding = Math.round) {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0
    && numeric <= 2_147_483_647 ? rounding(numeric) : null;
}

export function parseOfficialArenaRow(value: unknown, now = Date.now()): OfficialArenaRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.category !== "overall" || typeof row.model_name !== "string" || !row.model_name.trim()
    || typeof row.rating !== "number" || !Number.isFinite(row.rating) || row.rating <= 0 || row.rating > 3000
    || typeof row.leaderboard_publish_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.leaderboard_publish_date)) return null;
  const date = Date.parse(row.leaderboard_publish_date);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== row.leaderboard_publish_date
    || date > now || now - date > 45 * 86400000) return null;
  return { modelName: row.model_name.trim(), organization: typeof row.organization === "string" && row.organization.trim() ? row.organization.trim() : null, snapshotDate: row.leaderboard_publish_date,
    eloScore: Math.round(row.rating), confidenceLow: optionalInteger(row.rating_lower, Math.floor),
    confidenceHigh: optionalInteger(row.rating_upper, Math.ceil), votes: optionalInteger(row.vote_count), rank: optionalInteger(row.rank) };
}

export async function fetchOfficialArenaManifest(subset: ArenaSubset, signal: AbortSignal) {
  const decodeJson = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes));
  const info = decodeJson(await publicDownload(`${HUB}/revision/main`, 256 * 1024, signal)) as { sha?: unknown };
  if (typeof info.sha !== "string" || !/^[a-f0-9]{40}$/.test(info.sha)) throw new Error("Invalid official Arena revision");
  const revision = info.sha;
  const files = decodeJson(await publicDownload(`${HUB}/tree/${revision}/${subset}`, 64 * 1024, signal));
  const path = `${subset}/latest-00000-of-00001.parquet`;
  const file = Array.isArray(files) ? files.find((entry) => entry?.type === "file" && entry.path === path) : null;
  if (!file || !Number.isSafeInteger(file.size) || file.size < 12 || file.size > MAX_FILE_BYTES
    || typeof file.lfs?.oid !== "string" || !/^[a-f0-9]{64}$/.test(file.lfs.oid)) {
    throw new Error("Missing, oversized or unverified official Arena snapshot");
  }
  return { revision, path, size: file.size as number, sha256: file.lfs.oid as string };
}

export async function fetchOfficialArenaSnapshot(subset: ArenaSubset, parentSignal?: AbortSignal, timeoutMs = 25_000) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
  const { revision, path, size, sha256 } = await fetchOfficialArenaManifest(subset, signal);
  const bytes = await publicDownload(`https://huggingface.co/datasets/${ARENA_DATASET}/resolve/${revision}/${path}`, MAX_FILE_BYTES, signal);
  if (bytes.byteLength !== size || createHash("sha256").update(bytes).digest("hex") !== sha256) {
    throw new Error("Official Arena snapshot integrity check failed");
  }
  const metadata = parquetMetadata(bytes);
  const rowCount = Number(metadata.num_rows);
  const uncompressed = metadata.row_groups.reduce((total, group) => total + Number(group.total_byte_size), 0);
  if (!Number.isSafeInteger(rowCount) || rowCount <= 0 || rowCount > MAX_ROWS
    || !Number.isSafeInteger(uncompressed) || uncompressed <= 0 || uncompressed > MAX_UNCOMPRESSED_BYTES
    || !COLUMNS.every((name) => metadata.schema.some((field) => field.name === name))) {
    throw new Error("Unexpected official Arena snapshot schema or row budget");
  }
  signal.throwIfAborted();
  const records = await parquetReadObjects({ file: bytes.buffer as ArrayBuffer, metadata, columns: COLUMNS });
  signal.throwIfAborted();
  const overall = records.filter((row) => row.category === "overall");
  const rows = overall.map((row) => parseOfficialArenaRow(row)).filter((row): row is OfficialArenaRow => row !== null);
  // An incomplete or mixed publication must never replace the current leaderboard.
  if (!rows.length || rows.length !== overall.length || new Set(rows.map((row) => row.snapshotDate)).size !== 1) {
    throw new Error("Official Arena snapshot contains stale, invalid or mixed-date overall rows");
  }
  return { rows, revision, sha256, bytes: bytes.byteLength, publicationDate: rows[0].snapshotDate };
}

type AliasModel = ReturnType<typeof buildModelAliasIndex>["models"][number];

function providerKey(provider: string) {
  const canonical = normalizeProviderKey(getCanonicalProviderName(provider));
  return ["alibaba", "alibabacloud"].includes(canonical) ? "qwen" : canonical;
}

export function planOfficialArenaImport(subset: ArenaSubset, rows: OfficialArenaRow[], models: AliasModel[]) {
  const index = buildModelAliasIndex(models);
  const pending = new Map<string, {
    model_id: string; arena_name: string; elo_score: number; snapshot_date: string;
    confidence_interval_low: number | null; confidence_interval_high: number | null;
    num_battles: number | null; rank: number | null;
  }>();
  const unmatchedModels: string[] = [];
  let matchedRows = 0;
  for (const row of rows) {
    const identity = makeSlug(row.modelName);
    const ids = !row.organization ? [] : resolveAliasFamilyModelIds(index, { slugCandidates: [identity], nameCandidates: [row.modelName],
      allowLooseMatch: false, expandDatedVariants: false }).filter((id) => {
      const model = index.idToModel.get(id)!;
      const providerSlug = makeSlug(model.provider);
      const providerless = model.slug.startsWith(`${providerSlug}-`) ? model.slug.slice(providerSlug.length + 1) : model.slug;
      return [makeSlug(model.name), model.slug, providerless].includes(identity)
        && providerKey(model.provider) === providerKey(row.organization!);
    });
    if (!ids.length) { unmatchedModels.push(row.modelName); continue; }
    matchedRows++;
    for (const id of ids) {
      const rating = { model_id: id, arena_name: OFFICIAL_ARENAS[subset], elo_score: row.eloScore,
        snapshot_date: row.snapshotDate, confidence_interval_low: row.confidenceLow,
        confidence_interval_high: row.confidenceHigh, num_battles: row.votes, rank: row.rank };
      const key = `${id}:${row.snapshotDate}`;
      const previous = pending.get(key);
      if (!previous || rating.elo_score < previous.elo_score) pending.set(key, rating);
    }
  }
  return { ratings: [...pending.values()], matchedRows, unmatchedModels };
}
