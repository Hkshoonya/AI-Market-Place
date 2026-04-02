/**
 * Unit tests for buildRecord() factory function.
 *
 * Covers all provider default patterns:
 * 1. Anthropic-style: hardcoded category + modalities via ProviderDefaults
 * 2. OpenAI-style: no hardcoded category (inferred from model ID)
 * 3. Override precedence: overrides.name beats knownData.name
 * 4. Unknown model (knownData=undefined): fallback to modelId as name
 * 5. Slug generation shape
 */

import { describe, it, expect } from "vitest";
import { buildRecord } from "./build-record";
import type { KnownModelMeta, ProviderDefaults } from "./build-record";

// ────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────

const anthropicDefaults: ProviderDefaults = {
  provider: "Anthropic",
  slugPrefix: "anthropic",
  category: "multimodal",
  modalities: ["text", "image"],
  is_open_weights: false,
  license: "commercial",
  license_name: null,
};

const openaiDefaults: ProviderDefaults = {
  provider: "OpenAI",
  slugPrefix: "openai",
  // No category — should be inferred from model ID
  is_open_weights: false,
  license: "commercial",
  license_name: null,
};

const knownClaudeOpus: KnownModelMeta = {
  name: "Claude Opus 4.6",
  description: "Anthropic's most capable model for complex reasoning",
  context_window: 200000,
  release_date: "2025-04-01",
  status: "active",
  capabilities: { vision: true, function_calling: true },
};

const knownGpt4o: KnownModelMeta = {
  name: "GPT-4o",
  description: "OpenAI's flagship multimodal model",
  context_window: 128000,
  release_date: "2024-05-13",
  status: "active",
  capabilities: { vision: true, function_calling: true },
};

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe("buildRecord()", () => {
  it("produces correct slug, provider, and category for Anthropic model", () => {
    const record = buildRecord("claude-opus-4-6", knownClaudeOpus, {}, anthropicDefaults);

    expect(record.slug).toBe("anthropic-claude-opus-4-6");
    expect(record.provider).toBe("Anthropic");
    expect(record.category).toBe("multimodal"); // from ProviderDefaults
    expect(record.modalities).toEqual(["text", "image"]); // from ProviderDefaults
    expect(record.is_open_weights).toBe(false);
    expect(record.license).toBe("commercial");
  });

  it("infers category via inferCategory (id mode) when no category in ProviderDefaults", () => {
    const record = buildRecord("gpt-4o", knownGpt4o, {}, openaiDefaults);

    expect(record.slug).toBe("openai-gpt-4o");
    expect(record.provider).toBe("OpenAI");
    // gpt- prefix should infer "llm" from id mode
    expect(record.category).toBe("llm");
  });

  it("overrides win over knownData fields", () => {
    const overrides: Partial<KnownModelMeta> = {
      name: "Claude Opus 4.6 (Override Name)",
      description: "Overridden description",
    };
    const record = buildRecord("claude-opus-4-6", knownClaudeOpus, overrides, anthropicDefaults);

    expect(record.name).toBe("Claude Opus 4.6 (Override Name)");
    expect(record.description).toBe("Overridden description");
  });

  it("uses modelId as fallback name when knownData is undefined", () => {
    const record = buildRecord("unknown-model-xyz", undefined, {}, openaiDefaults);

    expect(record.slug).toBe("openai-unknown-model-xyz");
    expect(record.name).toBe("unknown-model-xyz");
    expect(record.description).toBeNull();
    expect(record.provider).toBe("OpenAI");
  });

  it("always sets is_api_available: true", () => {
    const record = buildRecord("claude-opus-4-6", knownClaudeOpus, {}, anthropicDefaults);
    expect(record.is_api_available).toBe(true);
  });

  it("always returns data_refreshed_at as an ISO string", () => {
    const record = buildRecord("claude-opus-4-6", knownClaudeOpus, {}, anthropicDefaults);
    expect(record.data_refreshed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("generates correct slug shape: 'openai-gpt-4o'", () => {
    const record = buildRecord("gpt-4o", knownGpt4o, {}, openaiDefaults);
    expect(record.slug).toBe("openai-gpt-4o");
  });

  it("carries over knownData fields: context_window, release_date, status, capabilities", () => {
    const record = buildRecord("claude-opus-4-6", knownClaudeOpus, {}, anthropicDefaults);

    expect(record.context_window).toBe(200000);
    expect(record.release_date).toBe("2025-04-01");
    expect(record.status).toBe("active");
    expect(record.capabilities).toEqual({ vision: true, function_calling: true });
  });

  it("null context_window and release_date when knownData is undefined", () => {
    const record = buildRecord("unknown-model-xyz", undefined, {}, openaiDefaults);

    expect(record.context_window).toBeNull();
    expect(record.release_date).toBeNull();
  });

  it("ProviderDefaults license fields override knownData license fields", () => {
    const knownWithLicense: KnownModelMeta = {
      name: "Some Model",
      description: "Test",
      license: "open_source",
      license_name: "MIT",
    };
    const record = buildRecord("some-model", knownWithLicense, {}, anthropicDefaults);

    // anthropicDefaults has license: "commercial", license_name: null
    expect(record.license).toBe("commercial");
    expect(record.license_name).toBeNull();
  });

  it("canonicalizes provider defaults before writing the model record", () => {
    const lowerCaseDefaults: ProviderDefaults = {
      ...openaiDefaults,
      provider: "openai",
    };

    const record = buildRecord("gpt-4o", knownGpt4o, {}, lowerCaseDefaults);

    expect(record.provider).toBe("OpenAI");
  });

  it("normalizes preview lifecycle from model identifiers even when upstream status says active", () => {
    const previewMeta: KnownModelMeta = {
      name: "GPT-4o Realtime Preview",
      description: "Realtime preview model",
      status: "active",
    };

    const record = buildRecord("gpt-4o-realtime-preview", previewMeta, {}, openaiDefaults);

    expect(record.status).toBe("preview");
  });

  it("maps legacy upstream categories to enum-safe categories", () => {
    const record = buildRecord(
      "sora-2",
      {
        name: "Sora 2",
        description: "Video generation model",
        category: "video_generation",
      },
      {},
      openaiDefaults
    );

    expect(record.category).toBe("video");
  });

  it("normalizes Apache-licensed rows to open weights even when upstream booleans drift", () => {
    const record = buildRecord(
      "gemma-3n-e4b-it",
      {
        name: "Gemma 3n",
        description: "Released under the Apache 2.0 license for private deployment.",
        is_open_weights: false,
        license: "commercial",
        license_name: "apache-2.0",
      },
      {},
      {
        provider: "Google",
        slugPrefix: "google",
      }
    );

    expect(record.is_open_weights).toBe(true);
    expect(record.license).toBe("open_source");
    expect(record.license_name).toBe("Apache 2.0");
  });
});
