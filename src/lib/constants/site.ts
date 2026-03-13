const DEFAULT_SITE_URL = "https://aimarketcap.tech";

export function getCanonicalOrigin(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return rawUrl.replace(/\/+$/, "");
}

export function buildCanonicalUrl(path: string): string {
  return new URL(path, `${getCanonicalOrigin()}/`).toString();
}

export function getCanonicalHost(): string {
  return new URL(getCanonicalOrigin()).host;
}

export function getCanonicalWwwHost(): string {
  const canonicalHost = getCanonicalHost();
  return canonicalHost.startsWith("www.")
    ? canonicalHost
    : `www.${canonicalHost}`;
}

export const SITE_NAME = "AI Market Cap";
export const SITE_DESCRIPTION =
  "Track, rank, and compare every AI model in the world. Real-time benchmarks, pricing, and marketplace.";
export const SITE_URL = getCanonicalOrigin();
