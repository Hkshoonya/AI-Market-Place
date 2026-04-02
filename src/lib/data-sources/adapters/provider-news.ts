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
  limitProviderScopedModelIds,
  resolveNewsRelations,
  type ModelLookupEntry,
} from "../model-matcher";
import { classifyNewsSignal } from "@/lib/news/signals";

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
  { name: "DeepSeek", url: "https://api-docs.deepseek.com/updates/", provider: "DeepSeek" },
  { name: "xAI", url: "https://x.ai/blog", provider: "xAI" },
  { name: "Cohere", url: "https://cohere.com/blog", provider: "Cohere" },
  { name: "Stability AI", url: "https://stability.ai/news", provider: "Stability AI" },
  { name: "Z.ai", url: "https://docs.z.ai/release-notes/new-released", provider: "Z.ai" },
  { name: "MiniMax", url: "https://www.minimax.io/news", provider: "MiniMax" },
];

const MODEL_KEYWORDS = [
  "model", "launch", "release", "introducing", "announce", "available",
  "benchmark", "performance", "upgrade", "new version", "llm", "gpt",
  "claude", "gemini", "llama", "mistral", "flux", "stable diffusion",
  "parameter", "context window", "training", "glm", "minimax", "hailuo",
  "m2.7", "m2.5", "m2.1", "m1", "z.ai", "zhipu",
];

const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08", sep: "09",
  sept: "09", oct: "10", nov: "11", dec: "12",
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
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})/i
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
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/gi
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

function inferPublishedAt(article: ParsedArticle): string | null {
  if (article.date) return article.date;
  return extractDate(article.title);
}

interface ParsedArticle {
  url: string;
  title: string;
  date: string | null;
}

interface ProviderHealthResult {
  name: string;
  ok: boolean;
  status: number | null;
  latencyMs: number;
}

function isBotChallengeResponse(res: Response): boolean {
  if (res.status !== 403) return false;

  const cfMitigated = res.headers.get("cf-mitigated");
  const server = res.headers.get("server")?.toLowerCase() ?? "";
  const setCookie = res.headers.get("set-cookie") ?? "";

  return (
    cfMitigated != null ||
    server.includes("cloudflare") ||
    setCookie.includes("__cf_bm=")
  );
}

function parseZaiReleaseNotes(html: string, baseUrl: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const seenUrls = new Set<string>();
  const entryPattern =
    /data-component-part="update-label">([^<]+)<\/div>\s*<div[^>]+data-component-part="update-description">\s*([^<]+)<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(html)) !== null) {
    const rawDate = match[1].trim();
    const rawTitle = match[2].trim();
    const pos = match.index;
    const window = html.slice(pos, pos + 1200);
    const href = window.match(/<a[^>]+href="([^"]+)"/)?.[1] ?? `#${rawDate}`;
    const url = resolveUrl(href, baseUrl);

    if (!rawTitle || seenUrls.has(url)) continue;
    seenUrls.add(url);

    articles.push({
      url,
      title: rawTitle,
      date: `${rawDate}T00:00:00.000Z`,
    });
  }

  return articles;
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
  if (baseUrl.includes("docs.z.ai/release-notes/new-released")) {
    const releaseNotes = parseZaiReleaseNotes(html, baseUrl);
    if (releaseNotes.length > 0) return releaseNotes;
  }

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

function summarizeHealthChecks(results: ProviderHealthResult[]): HealthCheckResult {
  const reachable = results.filter((result) => result.ok);
  const latencyMs =
    results.length > 0
      ? Math.round(results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length)
      : 0;

  if (reachable.length > 0) {
    return {
      healthy: true,
      latencyMs,
      message: `${reachable.length}/${results.length} provider blogs reachable`,
    };
  }

  const firstFailure = results[0];
  return {
    healthy: false,
    latencyMs,
    message:
      firstFailure?.status != null
        ? `${firstFailure.name} returned HTTP ${firstFailure.status}`
        : "All provider blogs unreachable",
  };
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
    const providerWarnings: Array<{ provider: string; message: string }> = [];
    let recordsProcessed = 0;
    const allRecords: Record<string, unknown>[] = [];
    let reachableProviders = 0;

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
          if (isBotChallengeResponse(res)) {
            providerWarnings.push({
              provider: blog.provider,
              message: `${blog.name} is blocking automated access with an anti-bot challenge`,
            });
            continue;
          }

          errors.push({
            message: `Failed to fetch ${blog.name} blog: HTTP ${res.status}`,
            context: `url=${blog.url}`,
          });
          continue;
        }

        reachableProviders++;
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
          const signal = classifyNewsSignal(article.title);
          const publishedAt = inferPublishedAt(article);
          const metadata: Record<string, unknown> = {
            provider: blog.provider,
            blog_url: blog.url,
            signal_type: signal.signalType,
            signal_importance: signal.importance,
            signal_flags: signal.flags,
          };
          const { modelIds } = modelLookup.length > 0
            ? resolveNewsRelations(article.title, null, metadata, modelLookup)
            : { modelIds: [] };
          const relatedModelIds = limitProviderScopedModelIds(modelIds);
          const relationScope =
            relatedModelIds.length > 0 ? "model" : modelIds.length > 0 ? "provider" : "none";
          metadata.match_scope = relationScope;
          metadata.matched_model_count = modelIds.length;

          allRecords.push({
            source: "provider-blog",
            source_id: makeSlug(
              `provider-news-${blog.provider}-${article.url}`
            ),
            title: article.title.slice(0, 500),
            summary: null,
            url: article.url,
            published_at: publishedAt ?? new Date().toISOString(),
            category: signal.category,
            related_provider: blog.provider,
            related_model_ids: relatedModelIds,
            tags: [...new Set([blog.provider.toLowerCase(), "blog", ...signal.tags])],
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
      success:
        errors.filter((e) => !e.context?.startsWith("url=")).length === 0 &&
        reachableProviders > 0,
      recordsProcessed,
      recordsCreated: allRecords.length,
      recordsUpdated: 0,
      errors,
      metadata: {
        providersChecked: PROVIDER_BLOGS.length,
        reachableProviders,
        providerWarnings,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.all(
      PROVIDER_BLOGS.slice(0, 3).map(async (blog) => {
        const start = Date.now();
        try {
          const res = await fetch(blog.url, {
            headers: { "User-Agent": "AI-Market-Cap-Bot/1.0" },
          });
          return {
            name: blog.name,
            ok: res.ok,
            status: res.status,
            latencyMs: Date.now() - start,
          };
        } catch {
          return {
            name: blog.name,
            ok: false,
            status: null,
            latencyMs: Date.now() - start,
          };
        }
      })
    );

    return summarizeHealthChecks(checks);
  },
};

export const __testables = {
  inferPublishedAt,
  isModelRelated,
  isBotChallengeResponse,
  parseZaiReleaseNotes,
  providerBlogs: PROVIDER_BLOGS,
  summarizeHealthChecks,
};

registerAdapter(adapter);
export default adapter;
