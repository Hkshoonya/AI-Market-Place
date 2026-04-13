import { buildCanonicalUrl, getCanonicalHost, SITE_URL } from "@/lib/constants/site";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_PATH = "/indexnow-key";
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10_000;

function readOptionalEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function getIndexNowKey() {
  return readOptionalEnv("INDEXNOW_KEY", "NEXT_PUBLIC_INDEXNOW_KEY");
}

export function getIndexNowKeyLocation() {
  return readOptionalEnv("INDEXNOW_KEY_LOCATION") ?? buildCanonicalUrl(INDEXNOW_KEY_PATH);
}

export function isIndexNowConfigured() {
  return Boolean(getIndexNowKey());
}

export function normalizeIndexNowUrls(urls: string[]) {
  const canonicalHost = getCanonicalHost();
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const candidate of urls) {
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        continue;
      }
      if (parsed.host !== canonicalHost) {
        continue;
      }

      parsed.hash = "";
      const normalizedUrl = parsed.toString();
      if (seen.has(normalizedUrl)) {
        continue;
      }

      seen.add(normalizedUrl);
      normalized.push(normalizedUrl);
    } catch {
      continue;
    }
  }

  return normalized;
}

function chunkUrls(urls: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < urls.length; index += INDEXNOW_MAX_URLS_PER_REQUEST) {
    chunks.push(urls.slice(index, index + INDEXNOW_MAX_URLS_PER_REQUEST));
  }
  return chunks;
}

export async function submitIndexNowUrls(urls: string[]) {
  const key = getIndexNowKey();
  if (!key) {
    throw new Error("INDEXNOW_KEY is not configured");
  }

  const host = getCanonicalHost();
  const keyLocation = getIndexNowKeyLocation();
  const normalizedUrls = normalizeIndexNowUrls(urls);

  if (normalizedUrls.length === 0) {
    return {
      endpoint: INDEXNOW_ENDPOINT,
      host,
      keyLocation,
      batchCount: 0,
      submittedUrlCount: 0,
    };
  }

  const batches = chunkUrls(normalizedUrls);

  for (const batch of batches) {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host,
        key,
        keyLocation,
        urlList: batch,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `IndexNow submission failed with status ${response.status}${
          body ? `: ${body}` : ""
        }`
      );
    }
  }

  return {
    endpoint: INDEXNOW_ENDPOINT,
    host,
    keyLocation,
    batchCount: batches.length,
    submittedUrlCount: normalizedUrls.length,
    siteUrl: SITE_URL,
  };
}
