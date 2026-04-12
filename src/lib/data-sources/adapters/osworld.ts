import { strFromU8, unzipSync } from "fflate";

import type {
  DataSourceAdapter,
  HealthCheckResult,
  SyncContext,
  SyncResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry } from "../utils";
import {
  decodeHtmlEntities,
  normalizeRemoteBenchmarkDate,
  syncRemoteBenchmarkEntries,
  type RemoteBenchmarkEntry,
} from "./remote-benchmark";

const OSWORLD_XLSX_URL = "https://os-world.github.io/static/data/self_reported_results.xlsx";
const OSWORLD_SHEET_NAME = "Screenshot";

function parseSharedStringsXml(xml: string) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    const fragments = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) =>
      decodeHtmlEntities(part[1])
    );
    return fragments.join("").trim();
  });
}

function buildWorkbookSheetMap(workbookXml: string, relationshipsXml: string) {
  const relTargetById = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relTargetById.set(match[1], match[2]);
  }

  const sheetPathByName = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const target = relTargetById.get(match[2]);
    if (target) {
      sheetPathByName.set(match[1], `xl/${target}`);
    }
  }

  return sheetPathByName;
}

function parseWorksheetRowsXml(xml: string, sharedStrings: string[]) {
  return [...xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map((match) => {
    const rowIndex = Number(match[1]);
    const cells = new Map<string, string>();

    for (const cell of match[2].matchAll(/<c[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const column = cell[1];
      const attrs = cell[2];
      const body = cell[3];
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";

      if (type === "inlineStr") {
        const value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((part) => decodeHtmlEntities(part[1]))
          .join("")
          .trim();
        cells.set(column, value);
        continue;
      }

      const rawValue = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      if (!rawValue) continue;
      cells.set(column, type === "s" ? sharedStrings[Number(rawValue)] ?? "" : rawValue);
    }

    return { rowIndex, cells };
  });
}

function parseOsWorldWorkbookRows(bytes: Uint8Array) {
  const zip = unzipSync(bytes);
  const workbookXml = strFromU8(zip["xl/workbook.xml"]);
  const relationshipsXml = strFromU8(zip["xl/_rels/workbook.xml.rels"]);
  const sharedStringsXml = strFromU8(zip["xl/sharedStrings.xml"]);
  const sharedStrings = parseSharedStringsXml(sharedStringsXml);
  const sheetPath = buildWorkbookSheetMap(workbookXml, relationshipsXml).get(OSWORLD_SHEET_NAME);

  if (!sheetPath || !zip[sheetPath]) {
    throw new Error(`OSWorld workbook is missing sheet "${OSWORLD_SHEET_NAME}"`);
  }

  const sheetRows = parseWorksheetRowsXml(strFromU8(zip[sheetPath]), sharedStrings);
  if (sheetRows.length === 0) return [];

  const headerRow = sheetRows[0];
  const headerByColumn = new Map<string, string>();
  for (const [column, value] of headerRow.cells.entries()) {
    headerByColumn.set(column, value);
  }

  return sheetRows.slice(1).map((row) =>
    Object.fromEntries(
      [...row.cells.entries()].map(([column, value]) => [headerByColumn.get(column) ?? column, value])
    )
  );
}

function normalizeOsWorldModelToken(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  if (lower === "4o") return "GPT-4o";
  if (/^claude 3\.7$/i.test(normalized)) return "Claude 3.7 Sonnet";
  if (/^gemini 2\.5$/i.test(normalized)) return "Gemini 2.5 Pro";

  return normalized;
}

export function extractOsWorldModelMatchNames(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>();

  const withMatch = trimmed.match(/\bw\/\s*([^)]+?)(?:\s*\(|$)/i);
  if (withMatch?.[1]) {
    candidates.add(normalizeOsWorldModelToken(withMatch[1]));
  }

  const openAiCuaMatch = trimmed.match(/OpenAI\s+CUA\s+([A-Za-z0-9.-]+)/i);
  if (openAiCuaMatch?.[1]) {
    candidates.add(normalizeOsWorldModelToken(openAiCuaMatch[1]));
  }

  const directModelMatch = trimmed.match(
    /\b(o1|o3|o4(?:-mini)?|gpt-?4o(?:-[\d-]+)?|gpt-?4\.1|claude\s+[\d.]+(?:\s+(?:sonnet|opus))?|gemini\s+[\d.]+(?:\s+(?:pro|flash))?|deepseek[\w .-]*|qwen[\w .-]*|llama[\w .-]*|grok[\w .-]*|mistral[\w .-]*|ui-tars[\w.-]*)\b/i
  );
  if (directModelMatch?.[1]) {
    candidates.add(normalizeOsWorldModelToken(directModelMatch[1]));
  }

  if (candidates.size === 0) {
    return [];
  }

  return [trimmed, ...candidates].filter(Boolean);
}

function parseOsWorldScore(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

export function extractOsWorldEntries(rows: Array<Record<string, string>>) {
  const bestByModel = new Map<string, RemoteBenchmarkEntry>();

  for (const row of rows) {
    const label = row.Model?.trim() ?? "";
    const matchNames = extractOsWorldModelMatchNames(label);
    const score = parseOsWorldScore(row.Score ?? "");
    const evaluationDate = normalizeRemoteBenchmarkDate(row.Date);
    const primaryMatchName = matchNames.find((candidate) => candidate !== label) ?? matchNames[0];

    if (matchNames.length === 0 || !primaryMatchName || score == null) continue;

    const orderedMatchNames = [
      primaryMatchName,
      ...matchNames.filter((candidate) => candidate !== primaryMatchName),
    ];
    const current = bestByModel.get(primaryMatchName);
    if (
      !current ||
      score > current.score ||
      (score === current.score &&
        (evaluationDate ?? "") > (current.evaluationDate ?? ""))
    ) {
      bestByModel.set(primaryMatchName, {
        matchNames: orderedMatchNames,
        score,
        evaluationDate,
      });
    }
  }

  return [...bestByModel.values()].sort((left, right) => right.score - left.score);
}

async function fetchOsWorldWorkbookBytes(signal?: AbortSignal) {
  const res = await fetchWithRetry(
    OSWORLD_XLSX_URL,
    {
      headers: {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "User-Agent": "AI-Market-Cap-Bot",
      },
      signal,
    },
    { signal }
  );

  if (!res.ok) {
    throw new Error(`OSWorld workbook returned HTTP ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

const adapter: DataSourceAdapter = {
  id: "osworld",
  name: "OSWorld",
  outputTypes: ["benchmarks"],
  defaultConfig: {},
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    let workbookRows: Array<Record<string, string>>;
    try {
      workbookRows = parseOsWorldWorkbookRows(await fetchOsWorldWorkbookBytes(ctx.signal));
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch or parse OSWorld workbook: ${error instanceof Error ? error.message : String(error)}`,
            context: "network_error",
          },
        ],
        metadata: { url: OSWORLD_XLSX_URL, sheet: OSWORLD_SHEET_NAME },
      };
    }

    const entries = extractOsWorldEntries(workbookRows);
    if (entries.length === 0) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "OSWorld returned no usable model rows", context: "empty_response" }],
        metadata: { url: OSWORLD_XLSX_URL, sheet: OSWORLD_SHEET_NAME },
      };
    }

    return syncRemoteBenchmarkEntries(ctx, {
      benchmarkSlug: "os-world",
      source: "osworld",
      entries,
      metadata: {
        url: OSWORLD_XLSX_URL,
        sheet: OSWORLD_SHEET_NAME,
        parsedEntries: entries.length,
      },
    });
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const rows = parseOsWorldWorkbookRows(await fetchOsWorldWorkbookBytes());
      const entries = extractOsWorldEntries(rows);
      return {
        healthy: entries.length > 0,
        latencyMs: Date.now() - start,
        message: entries.length > 0 ? `${entries.length} entries visible` : "No usable entries found",
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
