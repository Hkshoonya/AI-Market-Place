import type { TypedSupabaseClient } from "@/types/database";

const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;
const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|svg|avif)(?:[?#].*)?$/i;

function trimUrl(url: string) {
  return url.replace(/[),.!?]+$/g, "");
}

function isImageUrl(url: string) {
  return IMAGE_EXTENSIONS.test(url);
}

function hostLabel(hostname: string) {
  return hostname.replace(/^www\./, "");
}

export interface SocialLinkPreviewInput {
  url: string;
  metadata: Record<string, unknown>;
}

export function extractLinkPreviewUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const deduped = new Set<string>();

  for (const match of matches) {
    const normalized = trimUrl(match.trim());
    if (!normalized || isImageUrl(normalized)) continue;
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      deduped.add(parsed.toString());
    } catch {
      continue;
    }
  }

  return [...deduped].slice(0, 3);
}

export function buildLinkPreviewMetadata(url: string): Record<string, unknown> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      source_type: "link",
      label: "External link",
      source_host: null,
      action_label: "Open link",
    };
  }

  const hostname = hostLabel(parsed.hostname);
  const pathname = parsed.pathname.replace(/\/+$/, "");

  if (hostname === "x.com" || hostname === "twitter.com") {
    const statusMatch = pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    const handle = statusMatch?.[1] ?? null;
    const tweetId = statusMatch?.[2] ?? null;

    return {
      source_type: "x",
      label: handle ? `X update from @${handle}` : "X update",
      source_host: hostname,
      action_label: "Open on X",
      handle,
      tweet_id: tweetId,
      display_path: pathname || "/",
    };
  }

  if (hostname === "github.com") {
    const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)/);
    return {
      source_type: "github",
      label: repoMatch ? `GitHub · ${repoMatch[1]}/${repoMatch[2]}` : "GitHub link",
      source_host: hostname,
      action_label: "Open on GitHub",
      owner: repoMatch?.[1] ?? null,
      repo: repoMatch?.[2] ?? null,
    };
  }

  if (hostname.endsWith("huggingface.co")) {
    return {
      source_type: "huggingface",
      label: "Hugging Face link",
      source_host: hostname,
      action_label: "Open on Hugging Face",
      display_path: pathname || "/",
    };
  }

  const providerHostLabels: Record<string, string> = {
    "openai.com": "OpenAI update",
    "anthropic.com": "Anthropic update",
    "x.ai": "xAI update",
    "mistral.ai": "Mistral AI update",
    "ai.meta.com": "Meta AI update",
    "blog.google": "Google update",
  };

  const providerLabel =
    providerHostLabels[hostname] ??
    Object.entries(providerHostLabels).find(([key]) => hostname.endsWith(key))?.[1];

  if (providerLabel) {
    return {
      source_type: "provider_update",
      label: providerLabel,
      source_host: hostname,
      action_label: "Open source",
      display_path: pathname || "/",
    };
  }

  return {
    source_type: "link",
    label: hostname,
    source_host: hostname,
    action_label: "Open link",
    display_path: pathname || "/",
  };
}

export function buildSocialLinkPreviewsFromText(text: string): SocialLinkPreviewInput[] {
  return extractLinkPreviewUrls(text).map((url) => ({
    url,
    metadata: buildLinkPreviewMetadata(url),
  }));
}

export async function insertSocialPostLinkPreviews(
  admin: TypedSupabaseClient,
  postId: string,
  content: string
) {
  const previews = buildSocialLinkPreviewsFromText(content);
  if (previews.length === 0) return;

  const { error } = await admin.from("social_post_media").insert(
    previews.map((preview) => ({
      post_id: postId,
      media_type: "link_preview" as const,
      url: preview.url,
      alt_text: null,
      metadata: preview.metadata,
    }))
  );

  if (error) {
    throw new Error(`Failed to save link previews: ${error.message}`);
  }
}
