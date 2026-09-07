import type { KnownModelMeta } from "./build-record";
import type { ScrapedModelEntry } from "./adapter-syncer";

type Provider = "OpenAI" | "Anthropic";

export function providerModelDocumentUrl(provider: Provider, id: string): string | null {
  if (!/^[a-z][a-z0-9.-]{1,100}$/.test(id)) return null;
  if (provider === "Anthropic") {
    if (!/^claude-(?:fable|mythos|opus|sonnet|haiku)-\d+(?:-\d+)*$/.test(id)) return null;
    return `https://platform.claude.com/docs/en/models/${id.slice(7)}/overview`;
  }
  return `https://developers.openai.com/api/docs/models/${id}`;
}

export function parseProviderModelDocument(markdown: string, id: string, url: string): Partial<KnownModelMeta> | null {
  // A link or comparison-table mention is not evidence that this page describes the ID.
  if (markdown.match(/^Model ID:\s*`([^`]+)`\s*$/m)?.[1] !== id) return null;
  const name = markdown.match(/^title:\s*([^\n]+)$/m)?.[1] ?? markdown.match(/^#\s+([^\n]+)$/m)?.[1];
  const context = markdown.match(/Context window:\s*([\d,.]+)\s*([MK])?\s*tokens/i)
    ?? markdown.match(/([\d,.]+)\s*([MK])?\s+context window/i);
  if (!name || !context) return null;
  const multiplier = context[2]?.toUpperCase() === "M" ? 1e6 : context[2]?.toUpperCase() === "K" ? 1e3 : 1;
  const contextWindow = Number(context[1].replace(/,/g, "")) * multiplier;
  if (!Number.isSafeInteger(contextWindow) || contextWindow < 1 || contextWindow > 100_000_000) return null;
  const result: Partial<KnownModelMeta> = { name: name.replace(/^"|"$/g, "").trim(), context_window: contextWindow, website_url: url };
  const released = markdown.match(/\bReleased\s+([A-Z][a-z]+ \d{1,2}, 20\d{2})\b/)?.[1];
  if (released) {
    const date = Date.parse(`${released} 00:00:00 UTC`);
    if (Number.isFinite(date) && date <= Date.now()) result.release_date = new Date(date).toISOString().slice(0, 10);
  }
  // No scores, retirement inference, or family-based capabilities are invented.
  return result;
}

export async function enrichDiscoveredModelDocs(
  provider: Provider, ids: string[], knownIds: Set<string>, signal?: AbortSignal
): Promise<ScrapedModelEntry[]> {
  const entries: ScrapedModelEntry[] = ids.map((id) => ({ id }));
  // Bound origin traffic and cron duration; ID-only rows still sync if parsing fails.
  const candidates = entries.filter(({ id }) => !knownIds.has(id) && providerModelDocumentUrl(provider, id)).slice(0, 6);
  for (const entry of candidates) {
    if (signal?.aborted) break;
    const url = providerModelDocumentUrl(provider, entry.id)!;
    try {
      const timeout = AbortSignal.timeout(4000);
      const response = await fetch(`${url}.md`, { redirect: "error", headers: { Accept: "text/markdown" },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (!response.ok) continue;
      const reader = response.body?.getReader();
      if (!reader) continue;
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 256_000) { await reader.cancel(); break; }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      if (size > 256_000) continue;
      entry.overrides = parseProviderModelDocument(Buffer.concat(chunks).toString("utf8"), entry.id, url) ?? undefined;
    } catch { /* Keep discovery alive when optional metadata is unavailable. */ }
  }
  return entries;
}
