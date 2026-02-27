import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, upsertBatch } from "../utils";

const ARXIV_API = "http://export.arxiv.org/api/query";

const KNOWN_PROVIDERS = [
  "OpenAI", "Anthropic", "Google", "DeepMind", "Meta", "Microsoft",
  "NVIDIA", "Mistral", "DeepSeek", "Alibaba", "Stability AI",
  "Hugging Face", "xAI", "Cohere", "AI21", "Amazon", "Apple",
];

/** Parse arXiv Atom XML response into structured entries */
function parseArxivXml(xml: string) {
  const entries: {
    id: string;
    title: string;
    summary: string;
    published: string;
    authors: string[];
    categories: string[];
    link: string;
  }[] = [];

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const getId = entry.match(/<id>(.*?)<\/id>/);
    const getTitle = entry.match(/<title>([\s\S]*?)<\/title>/);
    const getSummary = entry.match(/<summary>([\s\S]*?)<\/summary>/);
    const getPublished = entry.match(/<published>(.*?)<\/published>/);

    if (!getId || !getTitle || !getSummary || !getPublished) continue;

    const fullUrl = getId[1].trim();
    const arxivId = fullUrl
      .replace("http://arxiv.org/abs/", "")
      .replace(/v\d+$/, "");
    const title = getTitle[1].trim().replace(/\s+/g, " ");
    const summary = getSummary[1].trim().replace(/\s+/g, " ");
    const published = getPublished[1].trim();

    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>(.*?)<\/name>/g;
    let am;
    while ((am = authorRegex.exec(entry)) !== null) authors.push(am[1].trim());

    const categories: string[] = [];
    const catRegex = /category term="([^"]+)"/g;
    let cm;
    while ((cm = catRegex.exec(entry)) !== null) categories.push(cm[1]);

    entries.push({
      id: arxivId,
      title,
      summary,
      published,
      authors,
      categories,
      link: `https://arxiv.org/abs/${arxivId}`,
    });
  }

  return entries;
}

function detectProvider(title: string, summary: string): string | null {
  const text = `${title} ${summary}`.toLowerCase();
  for (const p of KNOWN_PROVIDERS) {
    if (text.includes(p.toLowerCase())) return p;
  }
  return null;
}

function categorizePaper(cats: string[]): string {
  if (cats.some((c) => c.startsWith("cs.CL"))) return "nlp";
  if (cats.some((c) => c.startsWith("cs.CV"))) return "vision";
  if (cats.some((c) => c.startsWith("cs.AI"))) return "ai";
  if (cats.some((c) => c.startsWith("cs.LG"))) return "ml";
  return "general";
}

const adapter: DataSourceAdapter = {
  id: "arxiv",
  name: "arXiv Papers",
  outputTypes: ["news"],
  defaultConfig: {
    categories: ["cs.CL", "cs.AI", "cs.LG"],
    maxResults: 100,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const categories = (ctx.config.categories as string[]) ?? ["cs.CL", "cs.AI", "cs.LG"];
    const maxResults = (ctx.config.maxResults as number) ?? 100;
    const catQuery = categories.map((c) => `cat:${c}`).join("+OR+");
    const url = `${ARXIV_API}?search_query=${catQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;

    const errors: { message: string; context?: string }[] = [];
    let recordsProcessed = 0;

    try {
      const res = await fetchWithRetry(url, undefined, { signal: ctx.signal });
      if (!res.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          errors: [{ message: `arXiv API returned ${res.status}` }],
        };
      }

      const xml = await res.text();
      const entries = parseArxivXml(xml);
      recordsProcessed = entries.length;

      const records = entries.map((e) => ({
        source: "arxiv",
        source_id: e.id,
        title: e.title.slice(0, 500),
        summary: e.summary.slice(0, 2000),
        url: e.link,
        published_at: e.published,
        category: categorizePaper(e.categories),
        related_provider: detectProvider(e.title, e.summary),
        tags: e.categories,
        metadata: { authors: e.authors.slice(0, 10) },
      }));

      if (records.length > 0) {
        const { errors: ue } = await upsertBatch(
          ctx.supabase,
          "model_news",
          records,
          "source,source_id"
        );
        errors.push(...ue);
      }
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err) });
    }

    return {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated: recordsProcessed,
      recordsUpdated: 0,
      errors,
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${ARXIV_API}?search_query=cat:cs.CL&max_results=1`);
      return { healthy: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Failed",
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
