import { describe, expect, it } from "vitest";
import {
  canonicalizeAnthropicModelId,
  resolveAnthropicKnownModelMeta,
} from "./anthropic";

describe("resolveAnthropicKnownModelMeta", () => {
  it("resolves Claude Opus 5 and its provider aliases", () => {
    expect(resolveAnthropicKnownModelMeta("claude-opus-5")).toMatchObject({
      name: "Claude Opus 5",
      release_date: "2026-07-24",
      context_window: 1000000,
      status: "active",
      is_api_available: true,
      is_open_weights: false,
      website_url: "https://www.anthropic.com/news/claude-opus-5",
    });
    expect(resolveAnthropicKnownModelMeta("claude-opus-latest")?.name).toBe(
      "Claude Opus 5"
    );
    expect(
      canonicalizeAnthropicModelId("claude-opus-5-20260724-v1")
    ).toBe("claude-opus-5");
  });

  it("resolves Claude Sonnet 5 and dated aliases to current release metadata", () => {
    expect(resolveAnthropicKnownModelMeta("claude-sonnet-5")).toMatchObject({
      name: "Claude Sonnet 5",
      release_date: "2026-06-30",
      context_window: 1000000,
      status: "active",
      is_api_available: true,
      is_open_weights: false,
      website_url: "https://www.anthropic.com/news/claude-sonnet-5",
    });
    expect(resolveAnthropicKnownModelMeta("claude-sonnet-5-20260630-v1")).toMatchObject({
      name: "Claude Sonnet 5",
      release_date: "2026-06-30",
    });
    expect(canonicalizeAnthropicModelId("claude-sonnet-5-20260630-v1")).toBe(
      "claude-sonnet-5"
    );
  });

  it("resolves Claude Opus 4.8 canonical and generic aliases", () => {
    const canonical = resolveAnthropicKnownModelMeta("claude-opus-4-8");
    const genericAlias = resolveAnthropicKnownModelMeta("claude-4-8");
    const compressedAlias = resolveAnthropicKnownModelMeta("claude-opus-48");
    const datedAlias = resolveAnthropicKnownModelMeta("claude-opus-4-8-20260528-v1");

    expect(canonical).toMatchObject({
      name: "Claude Opus 4.8",
      release_date: "2026-05-28",
      website_url: "https://www.anthropic.com/news/claude-opus-4-8",
      context_window: 1000000,
    });
    expect(genericAlias?.release_date).toBe("2026-05-28");
    expect(compressedAlias?.release_date).toBe("2026-05-28");
    expect(datedAlias?.release_date).toBe("2026-05-28");
  });

  it("canonicalizes generic Anthropic aliases to the flagship model id", () => {
    expect(canonicalizeAnthropicModelId("claude-4-8")).toBe("claude-opus-4-8");
    expect(canonicalizeAnthropicModelId("claude-opus-48")).toBe("claude-opus-4-8");
    expect(canonicalizeAnthropicModelId("claude-opus-4-8-20260528-v1")).toBe(
      "claude-opus-4-8"
    );
  });

  it("inherits metadata for v1 aliases", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-opus-4-6-v1");
    expect(meta?.release_date).toBe("2025-12-12");
    expect(meta?.context_window).toBe(1000000);
  });

  it("inherits metadata for dated 4.5 aliases", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-sonnet-4-5-20250929");
    expect(meta?.release_date).toBe("2025-10-22");
    expect(meta?.context_window).toBe(200000);
  });

  it("inherits metadata for generic family aliases", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-sonnet-4");
    expect(meta?.release_date).toBe("2025-05-22");
    expect(meta?.context_window).toBe(200000);
  });

  it("inherits metadata for Claude Opus 4.1 variants", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-opus-4-1-20250805-v1");
    expect(meta?.release_date).toBe("2025-08-05");
    expect(meta?.context_window).toBe(200000);
  });

  it("marks older Opus-family releases as superseded by Claude Opus 5", () => {
    expect(resolveAnthropicKnownModelMeta("claude-4-opus")?.description).toMatch(
      /superseded by Claude Opus 5/i
    );
    expect(resolveAnthropicKnownModelMeta("claude-4-5-opus")?.description).toMatch(
      /superseded by Claude Opus 5/i
    );
    expect(resolveAnthropicKnownModelMeta("claude-opus-4-1")?.description).toMatch(
      /superseded by Claude Opus 5/i
    );
  });

  it("keeps restored Fable 5 proprietary while marking API access active", () => {
    expect(resolveAnthropicKnownModelMeta("claude-fable-5")).toMatchObject({
      name: "Claude Fable 5",
      status: "active",
      category: "multimodal",
      release_date: "2026-06-09",
      context_window: 1000000,
      is_api_available: true,
      is_open_weights: false,
      license: "commercial",
      license_name: null,
      website_url: "https://www.anthropic.com/news/claude-fable-5-mythos-5",
    });
    expect(resolveAnthropicKnownModelMeta("claude-fable-latest")).toMatchObject({
      name: "Claude Fable 5",
      status: "active",
      is_api_available: true,
      is_open_weights: false,
    });
    expect(canonicalizeAnthropicModelId("claude-fable-latest")).toBe(
      "claude-fable-5"
    );
    expect(
      resolveAnthropicKnownModelMeta("claude-fable-5")?.capabilities
    ).toMatchObject({
      safety_routing: true,
      data_retention_required: true,
    });
  });

  it("tracks Mythos 5 as proprietary limited availability", () => {
    expect(resolveAnthropicKnownModelMeta("claude-mythos-5")).toMatchObject({
      name: "Claude Mythos 5",
      status: "preview",
      context_window: 1000000,
      is_api_available: true,
      is_open_weights: false,
      license: "commercial",
    });
    expect(canonicalizeAnthropicModelId("claude-mythos-latest")).toBe(
      "claude-mythos-5"
    );
  });

  it("collapses Haiku 4.5 snapshots and batch endpoints into one model", () => {
    expect(resolveAnthropicKnownModelMeta("claude-haiku-4-5")).toMatchObject({
      name: "Claude Haiku 4.5",
      release_date: "2025-10-15",
      context_window: 200000,
      status: "active",
      is_api_available: true,
      is_open_weights: false,
    });
    expect(
      canonicalizeAnthropicModelId("claude-haiku-4-5-20251001")
    ).toBe("claude-haiku-4-5");
    expect(canonicalizeAnthropicModelId("claude-haiku-4-5-batch")).toBe(
      "claude-haiku-4-5"
    );
  });
});
