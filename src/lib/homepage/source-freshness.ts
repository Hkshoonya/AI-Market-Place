export const HOMEPAGE_CORE_SOURCE_SLUGS = [
  "openrouter-models",
  "openai-models",
  "anthropic-models",
  "google-models",
  "official-provider-models",
  "provider-news",
  "x-announcements",
] as const;

interface SourceFreshnessRow {
  slug: string;
  last_success_at?: string | null;
  last_sync_at?: string | null;
}

function parseValidTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getCoreSourceRefreshTimestamp(
  rows: SourceFreshnessRow[],
  requiredSlugs: readonly string[] = HOMEPAGE_CORE_SOURCE_SLUGS
): string | null {
  const rowsBySlug = new Map(rows.map((row) => [row.slug, row]));
  const timestamps: number[] = [];

  for (const slug of requiredSlugs) {
    const row = rowsBySlug.get(slug);
    if (!row) return null;

    const timestamp =
      parseValidTimestamp(row.last_success_at) ??
      parseValidTimestamp(row.last_sync_at);
    if (timestamp == null) return null;

    timestamps.push(timestamp);
  }

  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps)).toISOString();
}
