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
  try {
    Sentry.captureException(
      new Error(`Schema validation failed: ${schemaName}`),
      {
        tags: { "error.type": "schema_validation" },
        fingerprint: ["schema-validation", schemaName],
        extra: {
          schemaName,
          issueCount: error.issues.length,
          issues: error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message,
          })),
        },
      },
    );
  } catch {
    // Sentry not available (e.g., client-side without client config)
    console.error(`[schema-validation] ${schemaName}:`, error.issues);
  }
}
