import { describe, expect, it } from "vitest";
import {
  getCanonicalProviderName,
  getProviderBrand,
  getProviderSlug,
  resolveProviderSlug,
  providerMatchesCanonical,
} from "./providers";

describe("provider identity", () => {
  it("canonicalizes common provider casing and aliases", () => {
    expect(getCanonicalProviderName("openai")).toBe("OpenAI");
    expect(getCanonicalProviderName("Google")).toBe("Google");
    expect(getCanonicalProviderName("google")).toBe("Google");
    expect(getCanonicalProviderName("deepseek-ai")).toBe("DeepSeek");
    expect(getCanonicalProviderName("Alibaba / Qwen")).toBe("Qwen");
  });

  it("does not over-collapse unrelated owner names into major providers", () => {
    expect(getCanonicalProviderName("meta-innovation")).toBe("meta-innovation");
    expect(getCanonicalProviderName("topogoogles")).toBe("topogoogles");
  });

  it("builds stable provider slugs from canonical names", () => {
    expect(getProviderSlug("openai")).toBe("openai");
    expect(getProviderSlug("Mistral AI")).toBe("mistral-ai");
    expect(getProviderSlug("deepseek-ai")).toBe("deepseek");
  });

  it("resolves canonical and legacy provider slugs", () => {
    const providers = ["OpenAI", "Google", "Alibaba / Qwen", "deepseek-ai"];

    expect(resolveProviderSlug("openai", providers)).toBe("OpenAI");
    expect(resolveProviderSlug("google", providers)).toBe("Google");
    expect(resolveProviderSlug("qwen", providers)).toBe("Qwen");
    expect(resolveProviderSlug("alibaba-qwen", providers)).toBe("Qwen");
    expect(resolveProviderSlug("deepseek", providers)).toBe("DeepSeek");
    expect(resolveProviderSlug("deepseek-ai", providers)).toBe("DeepSeek");
  });

  it("matches canonical variants consistently", () => {
    expect(providerMatchesCanonical("openai", "OpenAI")).toBe(true);
    expect(providerMatchesCanonical("google", "Google")).toBe(true);
    expect(providerMatchesCanonical("Azure OpenAI", "OpenAI")).toBe(false);
  });

  it("resolves brand metadata from canonicalized names", () => {
    expect(getProviderBrand("openai")?.domain).toBe("openai.com");
    expect(getProviderBrand("nvidia")?.domain).toBe("nvidia.com");
  });
});
