import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock @sentry/nextjs before importing parse utilities
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import {
  parseQueryResult,
  parseQueryResultPartial,
  parseQueryResultSingle,
} from "./parse";

const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
});

describe("parseQueryResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated T[] on valid Supabase response", () => {
    const response = {
      data: [
        { id: "1", name: "Model A" },
        { id: "2", name: "Model B" },
      ],
      error: null,
    };

    const result = parseQueryResult(response, TestSchema, "TestSchema");

    expect(result).toEqual([
      { id: "1", name: "Model A" },
      { id: "2", name: "Model B" },
    ]);
  });

  it("returns empty array on Supabase error in response", () => {
    const response = {
      data: null,
      error: { message: "table not found", code: "42P01" },
    };

    const result = parseQueryResult(response, TestSchema, "TestSchema");

    expect(result).toEqual([]);
  });

  it("returns empty array on null data", () => {
    const response = {
      data: null,
      error: null,
    };

    const result = parseQueryResult(response, TestSchema, "TestSchema");

    expect(result).toEqual([]);
  });

  it("returns empty array on data that fails schema validation", () => {
    const response = {
      data: [{ id: 123, name: "Model A" }], // id should be string
      error: null,
    };

    const result = parseQueryResult(response, TestSchema, "TestSchema");

    expect(result).toEqual([]);
  });

  it("calls Sentry.captureException on validation failure with correct tags", () => {
    const response = {
      data: [{ id: 123, name: "Model A" }],
      error: null,
    };

    parseQueryResult(response, TestSchema, "TestSchema");

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const call = vi.mocked(Sentry.captureException).mock.calls[0];
    expect(call[0]).toBeInstanceOf(Error);
    expect((call[0] as Error).message).toContain("Schema validation failed: TestSchema");
    expect(call[1]).toMatchObject({
      tags: { "error.type": "schema_validation" },
    });
  });

  it("includes fingerprint ['schema-validation', schemaName] in Sentry call", () => {
    const response = {
      data: [{ id: 123 }],
      error: null,
    };

    parseQueryResult(response, TestSchema, "TestSchema");

    const call = vi.mocked(Sentry.captureException).mock.calls[0];
    expect(call[1]).toMatchObject({
      fingerprint: ["schema-validation", "TestSchema"],
    });
  });

  it("Sentry extras include issues array but NOT raw data", () => {
    const response = {
      data: [{ id: 123, name: "Model A" }],
      error: null,
    };

    parseQueryResult(response, TestSchema, "TestSchema");

    const call = vi.mocked(Sentry.captureException).mock.calls[0];
    const extras = (call[1] as Record<string, unknown>).extra as Record<string, unknown>;

    expect(extras.schemaName).toBe("TestSchema");
    expect(extras.issueCount).toBeGreaterThan(0);
    expect(Array.isArray(extras.issues)).toBe(true);
    // Must NOT include raw data
    expect(extras).not.toHaveProperty("data");
    expect(extras).not.toHaveProperty("rawData");
    expect(extras).not.toHaveProperty("input");
  });

  it("strips extra fields from validated data (Zod default passthrough)", () => {
    const response = {
      data: [{ id: "1", name: "Model A", extra_field: "should be kept by Zod 4 default" }],
      error: null,
    };

    const result = parseQueryResult(response, TestSchema, "TestSchema");

    // Zod 4 default allows extra fields -- validation should succeed
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].name).toBe("Model A");
  });
});

describe("parseQueryResultPartial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps valid rows when some rows fail schema validation", () => {
    const response = {
      data: [
        { id: "1", name: "Model A" },
        { id: 2, name: "Broken Model" },
        { id: "3", name: "Model C" },
      ],
      error: null,
    };

    const result = parseQueryResultPartial(response, TestSchema, "PartialSchema");

    expect(result).toEqual([
      { id: "1", name: "Model A" },
      { id: "3", name: "Model C" },
    ]);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when the response data is not an array", () => {
    const response = {
      data: { id: "1", name: "Not a list" },
      error: null,
    };

    const result = parseQueryResultPartial(response, TestSchema, "PartialSchema");

    expect(result).toEqual([]);
  });

  it("preserves valid provider rows when one row has malformed JSON-shaped fields", () => {
    const ProviderLikeSchema = z.object({
      slug: z.string(),
      provider: z.string(),
      supported_languages: z.array(z.string()),
      capabilities: z.record(z.string(), z.boolean()),
    });

    const response = {
      data: [
        {
          slug: "openai-o3",
          provider: "OpenAI",
          supported_languages: [],
          capabilities: { reasoning: true },
        },
        {
          slug: "broken-model",
          provider: "Broken Inc",
          supported_languages: "en",
          capabilities: "reasoning",
        },
        {
          slug: "openai-gpt-4o",
          provider: "OpenAI",
          supported_languages: ["en"],
          capabilities: { vision: true },
        },
      ],
      error: null,
    };

    const result = parseQueryResultPartial(
      response,
      ProviderLikeSchema,
      "ProviderLikeSchema"
    );

    expect(result).toEqual([
      {
        slug: "openai-o3",
        provider: "OpenAI",
        supported_languages: [],
        capabilities: { reasoning: true },
      },
      {
        slug: "openai-gpt-4o",
        provider: "OpenAI",
        supported_languages: ["en"],
        capabilities: { vision: true },
      },
    ]);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("parseQueryResultSingle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated T on valid response", () => {
    const response = {
      data: { id: "1", name: "Model A" },
      error: null,
    };

    const result = parseQueryResultSingle(response, TestSchema, "TestSchema");

    expect(result).toEqual({ id: "1", name: "Model A" });
  });

  it("returns null on Supabase error", () => {
    const response = {
      data: null,
      error: { message: "not found" },
    };

    const result = parseQueryResultSingle(response, TestSchema, "TestSchema");

    expect(result).toBeNull();
  });

  it("returns null on null data", () => {
    const response = {
      data: null,
      error: null,
    };

    const result = parseQueryResultSingle(response, TestSchema, "TestSchema");

    expect(result).toBeNull();
  });

  it("returns null and calls Sentry on validation failure", () => {
    const response = {
      data: { id: 123, name: "Model A" },
      error: null,
    };

    const result = parseQueryResultSingle(response, TestSchema, "TestSchema");

    expect(result).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("reportSchemaError fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to console.error when Sentry throws", () => {
    vi.mocked(Sentry.captureException).mockImplementation(() => {
      throw new Error("Sentry not initialized");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = {
      data: [{ id: 123 }],
      error: null,
    };

    // Should NOT throw -- falls back to console.error
    const result = parseQueryResult(response, TestSchema, "TestSchema");

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    const consoleCall = consoleSpy.mock.calls[0];
    expect(consoleCall[0]).toContain("[schema-validation]");
    expect(consoleCall[0]).toContain("TestSchema");

    consoleSpy.mockRestore();
  });
});
