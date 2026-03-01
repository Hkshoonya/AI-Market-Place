import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";
import {
  buildModelLookup,
  resolveNewsRelations,
  type ModelLookupEntry,
} from "../model-matcher";

/**
 * Provider News Adapter
 *
 * Scrapes blog/news pages from major AI companies and extracts article links,
 * titles, and dates. Filters to model-related announcements using keyword matching.
 * Uses regex-based HTML parsing — no DOM parser dependency.
 */

const PROVIDER_BLOGS = [
  { name: "OpenAI", url: "https://openai.com/blog", provider: "OpenAI" },
  { name: "Anthropic", url: "https://www.anthropic.com/news", provider: "Anthropic" },
  { name: "Google AI", url: "https://blog.google/technology/ai/", provider: "Google" },
  { name: "Meta AI", url: "https://ai.meta.com/blog/", provider: "Meta" },
  { name: "Mistral AI", url: "https://mistral.ai/news/", provider: "Mistral AI" },
  { name: "DeepSeek", url: "https://api-docs.deepseek.com/news", provider: "DeepSeek" },
  { name: "xAI", url: "https://x.ai/blog", provider: "xAI" },
  { name: "Cohere", url: "https://cohere.com/blog", provider: "Cohere" },
  { name: "Stability AI", url: "https://stability.ai/news", provider: "Stability AI" },
];

const MODEL_KEYWORDS = [
  "model", "launch", "release", "introducing", "announce", "available",
  "benchmark", "performance", "upgrade", "new version", "llm", "gpt",
  "claude", "gemini", "llama", "mistral", "flux", "stable diffusion",
  "parameter", "context window", "training",
];

const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/** Resolve a potentially relative href to an absolute URL using the blog's origin. */
function resolveUrl(href: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    if (href.startsWith("//")) return `${base.protocol}${href}`;
    if (href.startsWith("/")) return `${base.origin}${href}`;
    return `${base.origin}/${href}`;
  } catch {
    return href;
  }
}

/** Parse "January 15, 2025" or "January 15 2025" style dates to ISO string. */
function parseMonthNameDate(raw: string): string | null {
  const m = raw.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i
  );
  if (!m) return null;
  const month = MONTH_MAP[m[1].toLowerCase()];
  const day = m[2].padStart(2, "0");
  const year = m[3];
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

/** Extract the first usable date string from an HTML blob. */
function extractDate(html: string): string | null {
  // Prefer <time datetime="..."> which is most reliable
  const timeAttr = html.match(/<time[^>]+datetime="([^"]+)"/i);
  if (timeAttr) return new Date(timeAttr[1]).toISOString();

  // ISO date pattern: YYYY-MM-DD
  const isoMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return `${isoMatch[1]}T00:00:00.000Z`;

  // Month-name pattern: "January 15, 2025"
  const monthNameMatch = html.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi
  );
  if (monthNameMatch) return parseMonthNameDate(monthNameMatch[0]);

  return null;
}

/** Strip HTML tags and collapse whitespace from a raw text string. */
function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Return true if the title contains at least one model-related keyword. */
function isModelRelated(title: string): boolean {
  const lower = title.toLowerCase();
  return MODEL_KEYWORDS.some((kw) => lower.includes(kw));
}

interface ParsedArticle {
  url: string;
  title: string;
  date: string | null;
}

/**
 * Extract article candidates from raw HTML using generic regex patterns.
 *
 * Strategy:
 * 1. Try headline patterns: <h1-3> / <article> containing an <a> with href.
 * 2. Fall back to any <a> whose text looks like a title (> 20 chars).
 *
 * We scan a window of ~500 chars around each link match for a nearby date.
 */
function parseArticles(html: string, baseUrl: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const seenUrls = new Set<string>();

  // Pattern 1: headline tags wrapping an anchor
  const headlinePattern =
    /<(?:h[1-3]|article)[^>]*>([\s\S]*?)<\/(?:h[1-3]|article)>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headlinePattern.exec(html)) !== null) {
    const block = hm[1];
    const anchorPattern = /<a[^>]+href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = anchorPattern.exec(block)) !== null) {
      const href = am[1].trim();
      const rawTitle = stripHtml(am[2]);
      if (!rawTitle || rawTitle.length < 10) continue;

      const resolved = resolveUrl(href, baseUrl);
      if (seenUrls.has(resolved)) continue;
      seenUrls.add(resolved);

      // Look for a date in a surrounding window in the full HTML
      const pos = hm.index;
      const window = html.slice(Math.max(0, pos - 200), pos + 600);
      const date = extractDate(window);

      articles.push({ url: resolved, title: rawTitle, date });
    }
  }

  // Pattern 2: plain <a> tags as fallback (skip if headline pass gave results)
  if (articles.length === 0) {
    const linkPattern = /<a[^>]+href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkPattern.exec(html)) !== null) {
      const href = lm[1].trim();
      const rawTitle = stripHtml(lm[2]);
      if (!rawTitle || rawTitle.length < 20) continue;

      const resolved = resolveUrl(href, baseUrl);
      if (seenUrls.has(resolved)) continue;
      seenUrls.add(resolved);

      const pos = lm.index;
      const window = html.slice(Math.max(0, pos - 200), pos + 400);
      const date = extractDate(window);

      articles.push({ url: resolved, title: rawTitle, date });
    }
  }

  return articles;
}

const adapter: DataSourceAdapter = {
  id: "provider-news",
  name: "Provider News",
  outputTypes: ["news"],
  defaultConfig: {
    maxArticlesPerProvider: 10,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPerProvider =
      (ctx.config.maxArticlesPerProvider as number) ?? 10;

    const errors: { message: string; context?: string }[] = [];
    let recordsProcessed = 0;
    const allRecords: Record<string, unknown>[] = [];

    // Build model lookup for news-to-model linking
    let modelLookup: ModelLookupEntry[] = [];
    try {
      modelLookup = await buildModelLookup(ctx.supabase);
    } catch {
      // Non-fatal — continue without model linking
    }

    for (const blog of PROVIDER_BLOGS) {
      try {
        const res = await fetchWithRetry(
          blog.url,
          {
            headers: { "User-Agent": "AI-Market-Cap-Bot/1.0" },
          },
          { signal: ctx.signal, maxRetries: 2 }
        );

        if (!res.ok) {
          errors.push({
            message: `Failed to fetch ${blog.name} blog: HTTP ${res.status}`,
            context: `url=${blog.url}`,
          });
          continue;
        }

        const html = await res.text();
        const parsed = parseArticles(html, blog.url);

        if (parsed.length === 0) {
          // Structure likely changed — skip silently
          continue;
        }

        // Filter to model-related articles only, then take the most recent N
        const relevant = parsed
          .filter((a) => isModelRelated(a.title))
          .slice(0, maxPerProvider);

        for (const article of relevant) {
          recordsProcessed++;
          const metadata = { provider: blog.provider, blog_url: blog.url };
          const { modelIds } = modelLookup.length > 0
            ? resolveNewsRelations(article.title, null, metadata, modelLookup)
            : { modelIds: [] };

          allRecords.push({
            source: "provider-blog",
            source_id: makeSlug(
              `provider-news-${blog.provider}-${article.url}`
            ),
            title: article.title.slice(0, 500),
            summary: null,
            url: article.url,
            published_at: article.date ?? new Date().toISOString(),
            category: "announcement",
            related_provider: blog.provider,
            related_model_ids: modelIds.length > 0 ? modelIds : [],
            tags: [blog.provider.toLowerCase(), "blog"],
            metadata,
          });
        }
      } catch (err) {
        errors.push({
          message: `Error fetching ${blog.name} blog: ${err instanceof Error ? err.message : String(err)}`,
          context: `url=${blog.url}`,
        });
        // Continue to the next provider regardless of error type
      }
    }

    if (allRecords.length > 0) {
      const { errors: ue } = await upsertBatch(
        ctx.supabase,
        "model_news",
        allRecords,
        "source,source_id"
      );
      errors.push(...ue);
    }

    return {
      success: errors.filter((e) => !e.context?.startsWith("url=")).length === 0,
      recordsProcessed,
      recordsCreated: allRecords.length,
      recordsUpdated: 0,
      errors,
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(PROVIDER_BLOGS[0].url, {
        headers: { "User-Agent": "AI-Market-Cap-Bot/1.0" },
      });
      return {
        healthy: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? undefined : `HTTP ${res.status}`,
      };
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
