/**
 * PostgREST filter value sanitization
 *
 * Prevents injection of PostgREST operators via user input
 * in .or() and .ilike() Supabase filter strings.
 */

/**
 * Sanitize a value for safe use in PostgREST .or() filter strings.
 * Removes characters that could break out of filter value context:
 * commas (filter separator), periods (operator separator),
 * parentheses (grouping), backslashes, and quotes.
 */
export function sanitizeFilterValue(value: string): string {
  // Remove PostgREST special characters that could alter filter semantics
  return value.replace(/[,.()\\\\"']/g, "").trim();
}

/**
 * Sanitize a slug/identifier for safe use in PostgREST filters.
 * Only allows alphanumeric, hyphens, and underscores.
 */
export function sanitizeSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").trim();
}
