import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

/**
 * Represents a Supabase query response shape.
 * Both `data` and `error` can be null depending on query outcome.
 */
export type SupabaseResponse = {
  data: unknown;
  error: { message: string; code?: string; details?: string } | null;
};

/**
 * Validate a Supabase list query result with a Zod array schema.
 * Returns validated data on success, empty array on failure.
 * Reports validation errors to Sentry with schema_validation classification.
 *
 * @param response - The full Supabase `{ data, error }` response
 * @param schema - A Zod schema for a single item (will be wrapped in z.array())
 * @param schemaName - Human-readable name for Sentry grouping
 * @returns Validated T[] or empty array on any failure
 */
export function parseQueryResult<T>(
  response: SupabaseResponse,
  schema: z.ZodType<T>,
  schemaName: string,
): T[] {
  if (response.error || !response.data) {
    return [];
  }

  const result = z.array(schema).safeParse(response.data);

  if (!result.success) {
    reportSchemaError(schemaName, result.error);
    return [];
  }

  return result.data;
}

/**
 * Validate a Supabase list query result row-by-row.
 * Returns all valid rows even if some rows fail schema validation.
 * Reports any dropped rows to Sentry with schema_validation classification.
 *
 * Use this for high-volume directory/explorer pages where a single malformed row
 * should not blank the entire result set.
 */
export function parseQueryResultPartial<T>(
  response: SupabaseResponse,
  schema: z.ZodType<T>,
  schemaName: string,
): T[] {
  if (response.error || !response.data) {
    return [];
  }

  if (!Array.isArray(response.data)) {
    reportSchemaIssues(schemaName, [
      {
        code: "invalid_type",
        path: [],
        message: "Expected array response",
      },
    ]);
    return [];
  }

  const validRows: T[] = [];
  const issues: Array<{ code: string; path: Array<string | number>; message: string }> = [];

  response.data.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validRows.push(result.data);
      return;
    }

    issues.push(
      ...result.error.issues.map((issue) => ({
        code: issue.code,
        path: [
          index,
          ...issue.path.filter(
            (segment): segment is string | number =>
              typeof segment === "string" || typeof segment === "number"
          ),
        ],
        message: issue.message,
      }))
    );
  });

  if (issues.length > 0) {
    reportSchemaIssues(schemaName, issues);
  }

  return validRows;
}

/**
 * Validate a Supabase single-row query result (.single() / .maybeSingle()).
 * Returns validated data on success, null on failure.
 * Reports validation errors to Sentry with schema_validation classification.
 *
 * @param response - The full Supabase `{ data, error }` response
 * @param schema - A Zod schema for the expected object shape
 * @param schemaName - Human-readable name for Sentry grouping
 * @returns Validated T or null on any failure
 */
export function parseQueryResultSingle<T>(
  response: SupabaseResponse,
  schema: z.ZodType<T>,
  schemaName: string,
): T | null {
  if (response.error || !response.data) {
    return null;
  }

  const result = schema.safeParse(response.data);

  if (!result.success) {
    reportSchemaError(schemaName, result.error);
    return null;
  }

  return result.data;
}

/**
 * Report a schema validation error to Sentry.
 * Wrapped in try-catch so client-side (where Sentry may not be initialized)
 * falls back to console.error.
 *
 * IMPORTANT: Does NOT include raw data -- privacy risk (user info, emails, financial data).
 */
function reportSchemaError(schemaName: string, error: z.ZodError): void {
  reportSchemaIssues(
    schemaName,
    error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.filter(
        (segment): segment is string | number =>
          typeof segment === "string" || typeof segment === "number"
      ),
      message: issue.message,
    }))
  );
}

function reportSchemaIssues(
  schemaName: string,
  issues: Array<{ code: string; path: Array<string | number>; message: string }>
): void {
  try {
    Sentry.captureException(
      new Error(`Schema validation failed: ${schemaName}`),
      {
        tags: { "error.type": "schema_validation" },
        fingerprint: ["schema-validation", schemaName],
        extra: {
          schemaName,
          issueCount: issues.length,
          issues,
        },
      },
    );
  } catch {
    // Sentry not available (e.g., client-side without client config)
    console.error(`[schema-validation] ${schemaName}:`, issues);
  }
}
