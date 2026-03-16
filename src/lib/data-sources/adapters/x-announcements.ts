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
import { classifyNewsSignal } from "@/lib/news/signals";

/**
 * X.com Model Announcements Adapter
 *
 * Monitors AI company X/Twitter accounts for model-related posts.
 *
 * Fetch strategy (tried in order per account):
 *   1. X syndication timeline — embedded public timeline HTML
 *   2. Self-hosted RSSHub     — RSSHUB_BASE_URL/twitter/user/{handle} (needs TWITTER_COOKIE)
 *   3. xcancel.com            — public Nitter fork RSS (unreliable)
 *   4. Public RSSHub          — rsshub.app (often blocked without cookie)
 *   5. rss.app                — fallback (often blocked)
 *
 * Setup for reliable feeds:
 *   1. Add TWITTER_COOKIE to .env.local (auth_token + ct0 from browser)
 *   2. Run: docker compose up -d  (starts local RSSHub on port 1200)
 *   3. Optionally set RSSHUB_BASE_URL if not using default port
 *
 * Tweets are filtered by MODEL_KEYWORDS and upserted into model_news.
 * If every timeline source fails for every account the adapter returns
 * success=false so pipeline health reflects the gap honestly.
 */

const MONITORED_ACCOUNTS = [
  { handle: "OpenAI", provider: "OpenAI" },
  { handle: "AnthropicAI", provider: "Anthropic" },
  { handle: "GoogleDeepMind", provider: "Google" },
  { handle: "GoogleAI", provider: "Google" },
  { handle: "AIatMeta", provider: "Meta" },
  { handle: "MistralAI", provider: "Mistral AI" },
  { handle: "deepseek_ai", provider: "DeepSeek" },
  { handle: "xai", provider: "xAI" },
  { handle: "CohereAI", provider: "Cohere" },
  { handle: "MicrosoftAI", provider: "Microsoft" },
  { handle: "huggingface", provider: "Hugging Face" },
  { handle: "StabilityAI", provider: "Stability AI" },
];

const SYNDICATION_TIMELINE_URL =
  "https://syndication.twitter.com/srv/timeline-profile/screen-name/";

const MODEL_KEYWORDS = [
  "model", "launch", "release", "introducing", "announce", "available",
  "benchmark", "performance", "upgrade", "new version", "llm", "gpt",
  "claude", "gemini", "llama", "mistral", "flux", "stable diffusion",
  "parameter", "context window", "training", "fine-tun", "open source",
  "api", "developer", "safety",
];

/**
 * Build ordered list of RSS endpoint templates.
 * Self-hosted RSSHub (if configured) is always tried first — it's the
 * only reliable option since it uses the user's own Twitter cookie.
 */
function getRssEndpointTemplates(): Array<(handle: string) => string> {
  const templates: Array<(handle: string) => string> = [];

  // Priority 1: Self-hosted RSSHub (requires TWITTER_COOKIE in Docker env)
  const rsshubUrl = process.env.RSSHUB_BASE_URL;
  if (rsshubUrl) {
    const base = rsshubUrl.replace(/\/+$/, "");
    templates.push((handle: string) => `${base}/twitter/user/${handle}`);
  }

  // Priority 2: xcancel.com (community Nitter fork — free but unreliable)
  templates.push((handle: string) => `https://xcancel.com/${handle}/rss`);
  templates.push((handle: string) => `https://rss.xcancel.com/${handle}/rss`);

  // Priority 3: Public RSSHub (usually blocked without cookie)
  templates.push((handle: string) => `https://rsshub.app/twitter/user/${handle}`);

  // Priority 4: rss.app (often blocked)
  templates.push((handle: string) => `https://rss.app/feeds/twitter/${handle}`);

  return templates;
}

// --------------- RSS XML helpers ---------------

interface ParsedTweet {
  id: string | null;
  text: string;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
}

/**
 * Extract the numeric tweet ID from an item URL.
 * Handles both x.com and twitter.com status URLs.
 */
function extractTweetId(url: string): string | null {
  const m = url.match(/\/status(?:es)?\/(\d+)/);
  return m ? m[1] : null;
}

/** Decode common HTML entities in feed text. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Strip HTML tags and collapse whitespace. */
function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractImageUrl(block: string): string | null {
  const mediaMatch =
    block.match(/<media:content[^>]+url="([^"]+)"/i) ||
    block.match(/<media:thumbnail[^>]+url="([^"]+)"/i) ||
    block.match(/<img[^>]+src="([^"]+)"/i);

  return mediaMatch?.[1]?.trim() ?? null;
}

function hasStatusLikeUrl(url: string): boolean {
  return /\/status(?:es)?\/\d+/.test(url);
}

function isBlockedRssFeed(xml: string): boolean {
  const lower = xml.toLowerCase();

  return (
    lower.includes("rss reader not yet whitelist") ||
    lower.includes("rss reader not yet whitelisted") ||
    lower.includes("please send an email rss [at] xcancel")
  );
}

function isUsableRssFeed(xml: string, fallbackHandle: string): boolean {
  if (!(xml.includes("<item") || xml.includes("<entry"))) return false;
  if (isBlockedRssFeed(xml)) return false;

  const tweets = parseRssFeed(xml, fallbackHandle);
  return tweets.some((tweet) => tweet.id != null || hasStatusLikeUrl(tweet.url));
}

function extractSyndicationTimelineData(html: string): string | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i
  );

  return match?.[1] ?? null;
}

function parseSyndicationTimeline(html: string, fallbackHandle: string): ParsedTweet[] {
  const payload = extractSyndicationTimelineData(html);
  if (!payload) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return [];
  }

  const entries = (parsed as {
    props?: { pageProps?: { timeline?: { entries?: Array<Record<string, unknown>> } } };
  })?.props?.pageProps?.timeline?.entries;

  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    if (entry.type !== "tweet") return [];

    const content =
      entry.content && typeof entry.content === "object"
        ? (entry.content as Record<string, unknown>)
        : null;
    const tweet =
      content?.tweet && typeof content.tweet === "object"
        ? (content.tweet as Record<string, unknown>)
        : null;
    if (!tweet) return [];

    const rawText =
      typeof tweet.full_text === "string"
        ? tweet.full_text
        : typeof tweet.text === "string"
          ? tweet.text
          : "";
    const text = decodeEntities(stripHtml(rawText));
    const isReply = typeof tweet.in_reply_to_name === "string" && tweet.in_reply_to_name.length > 0;
    if (!text || text.startsWith("RT @") || isReply) return [];

    const id =
      typeof tweet.id_str === "string"
        ? tweet.id_str
        : typeof tweet.conversation_id_str === "string"
          ? tweet.conversation_id_str
          : null;

    const permalink =
      typeof tweet.permalink === "string" && tweet.permalink.startsWith("/")
        ? `https://x.com${tweet.permalink}`
        : id
          ? `https://x.com/${fallbackHandle}/status/${id}`
          : `https://x.com/${fallbackHandle}`;

    const rawDate = typeof tweet.created_at === "string" ? tweet.created_at : "";
    let publishedAt = new Date().toISOString();
    const parsedDate = rawDate ? Date.parse(rawDate) : Number.NaN;
    if (Number.isFinite(parsedDate)) {
      publishedAt = new Date(parsedDate).toISOString();
    }

    const mediaContainers = [tweet.entities, tweet.extended_entities]
      .filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"))
      .flatMap((value) =>
        Array.isArray(value.media)
          ? (value.media as Array<Record<string, unknown>>)
          : []
      );

    const firstMedia = mediaContainers[0];
    const imageUrl =
      typeof firstMedia?.media_url_https === "string"
        ? firstMedia.media_url_https
        : typeof firstMedia?.media_url === "string"
          ? firstMedia.media_url
          : null;

    return [{ id, text, url: permalink, publishedAt, imageUrl }];
  });
}

/**
 * Parse RSS 2.0 / Atom XML into a flat array of tweet-like items.
 * Works on both RSSHub (RSS 2.0) and xcancel/nitter (Atom) output formats.
 */
function parseRssFeed(xml: string, fallbackHandle: string): ParsedTweet[] {
  const tweets: ParsedTweet[] = [];

  // Match <item> (RSS 2.0) or <entry> (Atom) blocks
  const itemPattern = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];

    // Title / description — prefer <title>, fall back to <description> or <content>
    const titleMatch =
      block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/);

    const descMatch =
      block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/) ||
      block.match(/<content[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content>/) ||
      block.match(/<content[^>]*>([\s\S]*?)<\/content>/);

    const rawText = titleMatch?.[1] ?? descMatch?.[1] ?? "";
    const text = decodeEntities(stripHtml(rawText));
    if (!text) continue;

    // Link — try <link> element then href attribute
    const linkMatch =
      block.match(/<link[^>]+href="([^"]+)"/) ||
      block.match(/<link[^>]*>(https?:\/\/[^<]+)<\/link>/);
    const itemUrl = linkMatch?.[1]?.trim() ??
      `https://x.com/${fallbackHandle}`;

    // Published date — try <pubDate>, <published>, <updated>
    const dateMatch =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) ||
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/) ||
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/);
    const rawDate = dateMatch?.[1]?.trim() ?? "";
    let publishedAt: string;
    try {
      publishedAt = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    const tweetId = extractTweetId(itemUrl);
    const imageUrl = extractImageUrl(block);

    tweets.push({ id: tweetId, text, url: itemUrl, publishedAt, imageUrl });
  }

  return tweets;
}

/** Return true if tweet text contains at least one model-related keyword. */
function isModelRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return MODEL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Attempt to fetch an RSS feed from any of the configured endpoint templates.
 * Returns the parsed XML string on first success, or null if all fail.
 */
async function fetchRssForHandle(
  handle: string,
  templates: Array<(handle: string) => string>,
  signal?: AbortSignal
): Promise<{ xml: string; source: string } | null> {
  for (const template of templates) {
    const url = template(handle);
    try {
      const res = await fetchWithRetry(
        url,
        { headers: { "User-Agent": "AI-Market-Cap-Bot/1.0", Accept: "application/rss+xml, application/xml, text/xml" } },
        { signal, maxRetries: 1 }
      );
      if (!res.ok) continue;

      const text = await res.text();
      if (isUsableRssFeed(text, handle)) {
        return { xml: text, source: new URL(url).hostname };
      }
    } catch {
      // Try next endpoint
    }
  }
  return null;
}

async function fetchSyndicationForHandle(
  handle: string,
  signal?: AbortSignal
): Promise<{ tweets: ParsedTweet[]; source: string } | null> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "AI-Market-Cap-Bot/1.0",
      Accept: "text/html,application/xhtml+xml",
    };

    if (process.env.TWITTER_COOKIE) {
      headers.Cookie = process.env.TWITTER_COOKIE;
    }

    const res = await fetchWithRetry(
      `${SYNDICATION_TIMELINE_URL}${handle}`,
      { headers },
      { signal, maxRetries: 1 }
    );
    if (!res.ok) return null;

    const html = await res.text();
    const tweets = parseSyndicationTimeline(html, handle);
    if (tweets.length === 0) return null;

    return {
      tweets,
      source: new URL(SYNDICATION_TIMELINE_URL).hostname,
    };
  } catch {
    return null;
  }
}

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "x-announcements",
  name: "X.com Model Announcements",
  outputTypes: ["news"],
  defaultConfig: {
    maxTweetsPerAccount: 10,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxTweetsPerAccount =
      (ctx.config.maxTweetsPerAccount as number) ?? 10;

    const errors: { message: string; context?: string }[] = [];
    let recordsProcessed = 0;
    const allRecords: Record<string, unknown>[] = [];
    const templates = getRssEndpointTemplates();
    let workingSource: string | null = null;

    // Build model lookup for news-to-model linking
    let modelLookup: ModelLookupEntry[] = [];
    try {
      modelLookup = await buildModelLookup(ctx.supabase);
    } catch {
      // Non-fatal — continue without model linking
    }

    for (const account of MONITORED_ACCOUNTS) {
      try {
        const syndication = await fetchSyndicationForHandle(account.handle, ctx.signal);
        let tweets: ParsedTweet[] = [];

        if (syndication) {
          tweets = syndication.tweets;
          if (!workingSource) workingSource = syndication.source;
        } else {
          const result = await fetchRssForHandle(account.handle, templates, ctx.signal);
          if (!result) {
            errors.push({
              message: `All timeline endpoints failed for @${account.handle}`,
              context: `handle=${account.handle}`,
            });
            continue;
          }

          if (!workingSource) workingSource = result.source;
          tweets = parseRssFeed(result.xml, account.handle);
        }

        if (tweets.length === 0) {
          errors.push({
            message: `No usable timeline entries for @${account.handle}`,
            context: `handle=${account.handle}`,
          });
          continue;
        }

        const relevant = tweets
          .filter((t) => isModelRelated(t.text))
          .slice(0, maxTweetsPerAccount);

        recordsProcessed += relevant.length;

        for (const tweet of relevant) {
          // Build a stable source_id from tweet ID if available, otherwise date
          const idSuffix = tweet.id ?? makeSlug(tweet.publishedAt);
          const tweetUrl = tweet.id
            ? `https://x.com/${account.handle}/status/${tweet.id}`
            : tweet.url;
          const signal = classifyNewsSignal(tweet.text);

          const tweetMeta = {
            handle: account.handle,
            provider: account.provider,
            tweet_id: tweet.id,
            preview_image_url: tweet.imageUrl,
            signal_type: signal.signalType,
            signal_importance: signal.importance,
            signal_flags: signal.flags,
          };
          const { modelIds } = modelLookup.length > 0
            ? resolveNewsRelations(tweet.text, null, tweetMeta, modelLookup)
            : { modelIds: [] };

          allRecords.push({
            source: "x-twitter",
            source_id: makeSlug(`x-${account.handle}-${idSuffix}`),
            title: tweet.text.substring(0, 200),
            summary: tweet.text,
            url: tweetUrl,
            published_at: tweet.publishedAt,
            category: signal.category,
            related_provider: account.provider,
            related_model_ids: modelIds.length > 0 ? modelIds : [],
            tags: [...new Set([account.provider.toLowerCase(), "twitter", "x", ...signal.tags])],
            metadata: tweetMeta,
          });
        }
      } catch (err) {
        errors.push({
          message: `Error processing @${account.handle}: ${err instanceof Error ? err.message : String(err)}`,
          context: `handle=${account.handle}`,
        });
        // Continue to next account regardless of error
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

    const fatalErrors = errors.filter((e) => !e.context?.startsWith("handle="));
    const hadAnyTimelineData = recordsProcessed > 0 || workingSource !== null;
    return {
      success: fatalErrors.length === 0 && hadAnyTimelineData,
      recordsProcessed,
      recordsCreated: allRecords.length,
      recordsUpdated: 0,
      errors,
      metadata: {
        rssSource: workingSource ?? "none",
        rsshubConfigured: !!process.env.RSSHUB_BASE_URL,
        syndicationEnabled: true,
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const templates = getRssEndpointTemplates();
    const testHandle = MONITORED_ACCOUNTS[0].handle;

    const syndication = await fetchSyndicationForHandle(testHandle);
    if (syndication && syndication.tweets.length > 0) {
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        message: `Timeline feeds available via ${syndication.source}`,
      };
    }

    // Try each endpoint template until one works
    for (const template of templates) {
      const testUrl = template(testHandle);
      try {
        const res = await fetch(testUrl, {
          headers: { "User-Agent": "AI-Market-Cap-Bot/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
        });
        const text = res.ok ? await res.text() : "";
        if (res.ok && isUsableRssFeed(text, testHandle)) {
          return {
            healthy: true,
            latencyMs: Date.now() - start,
            message: `RSS feeds available via ${new URL(testUrl).hostname}`,
          };
        }
      } catch {
        // Try next
      }
    }

    return {
      healthy: false,
      latencyMs: Date.now() - start,
      message: process.env.RSSHUB_BASE_URL
        ? "Timeline feeds unavailable — syndication and RSSHub both failed"
        : "Timeline feeds unavailable — syndication failed and no RSSHub bridge is configured",
    };
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  parseRssFeed,
  extractImageUrl,
  extractTweetId,
  extractSyndicationTimelineData,
  parseSyndicationTimeline,
  isUsableRssFeed,
};
