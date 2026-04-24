import { z } from "zod";

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

function parseExternalUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

export function isSafeExternalUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return parseExternalUrl(value.trim()) !== null;
}

export function getSafeExternalHref(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return parseExternalUrl(trimmed) ? trimmed : null;
}

export function nullableHttpUrlSchema(fieldName: string) {
  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
      }
      return value;
    },
    z
      .union([
        z
          .string()
          .max(2048, `${fieldName} must be 2048 characters or less`)
          .refine(
            (candidate) => isSafeExternalUrl(candidate),
            `${fieldName} must be a valid http or https URL`
          ),
        z.null(),
      ])
      .optional()
  );
}

export function normalizeOptionalHttpUrl(
  value: unknown,
  fieldName: string
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a valid http or https URL`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isSafeExternalUrl(trimmed)) {
    throw new Error(`${fieldName} must be a valid http or https URL`);
  }

  return trimmed;
}
