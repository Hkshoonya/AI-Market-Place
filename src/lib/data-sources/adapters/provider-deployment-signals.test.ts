import { describe, expect, it } from "vitest";

import { __testables } from "./provider-deployment-signals";
import { buildModelAliasIndex } from "../model-alias-resolver";

describe("provider-deployment-signals adapter", () => {
  it("extracts title, description, and publish time from provider pages", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="MiniMax M2 open-source deployment update" />
          <meta
            property="og:description"
            content="MiniMax documents self-host deployment for the M2 family with vLLM and SGLang."
          />
          <meta property="article:published_time" content="2026-03-28T12:00:00.000Z" />
        </head>
      </html>
    `;

    expect(__testables.extractTitle(html)).toBe("MiniMax M2 open-source deployment update");
    expect(__testables.extractDescription(html)).toBe(
      "MiniMax documents self-host deployment for the M2 family with vLLM and SGLang."
    );
    expect(__testables.extractPublishedAt(html)).toBe("2026-03-28T12:00:00.000Z");
  });

  it("decodes HTML entities in extracted titles and descriptions", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Coding with Kimi K2: Top 6 Agents &amp; Setup Guides" />
          <meta
            property="og:description"
            content="Moonshot AI&#x27;s official guide for local coding tools."
          />
        </head>
      </html>
    `;

    expect(__testables.extractTitle(html)).toBe("Coding with Kimi K2: Top 6 Agents & Setup Guides");
    expect(__testables.extractDescription(html)).toBe(
      "Moonshot AI's official guide for local coding tools."
    );
  });

  it("treats generic Z.ai doc chrome as a fallback case", () => {
    expect(
      __testables.isGenericTitle("Overview - Overview - Z.AI DEVELOPER DOCUMENT", {
        id: "zai-devpack-overview",
        provider: "Z.ai",
        url: "https://docs.z.ai/devpack/overview",
        titleHint: "GLM coding plan deployment guide",
        modelHints: ["GLM-5"],
        signalType: "api",
        summaryHint: "Z.ai documents GLM deployment through its coding plan.",
      })
    ).toBe(true);
  });

  it("prefers exact non-variant model matches for generic provider deployment hints", () => {
    const models = [
      {
        id: "glm-4-6",
        slug: "z-ai-glm-4-6",
        name: "GLM 4.6",
        provider: "Z.ai",
      },
      {
        id: "glm-4-6-exacto",
        slug: "z-ai-glm-4-6-exacto",
        name: "GLM 4.6 (exacto)",
        provider: "Z-ai",
      },
    ];

    const result = __testables.resolveHintedModelIds(
      {
        id: "zai-devpack-overview",
        provider: "Z.ai",
        url: "https://docs.z.ai/devpack/overview",
        titleHint: "GLM coding plan deployment guide",
        modelHints: ["GLM-4.6"],
        signalType: "api",
        summaryHint: "Z.ai documents GLM deployment through its coding plan.",
      },
      ["GLM-4.6"],
      buildModelAliasIndex(models),
      models
    );

    expect(result).toEqual(["glm-4-6"]);
  });

  it("keeps variant-specific matches when the hint explicitly names the variant", () => {
    const models = [
      {
        id: "glm-4-6",
        slug: "z-ai-glm-4-6",
        name: "GLM 4.6",
        provider: "Z.ai",
      },
      {
        id: "glm-4-6-exacto",
        slug: "z-ai-glm-4-6-exacto",
        name: "GLM 4.6 (exacto)",
        provider: "Z-ai",
      },
    ];

    const result = __testables.resolveHintedModelIds(
      {
        id: "zai-exacto-guide",
        provider: "Z.ai",
        url: "https://docs.z.ai/devpack/overview",
        titleHint: "GLM exacto guide",
        modelHints: ["GLM-4.6 exacto"],
        signalType: "api",
        summaryHint: "Variant-specific guide.",
      },
      ["GLM-4.6 exacto"],
      buildModelAliasIndex(models),
      models
    );

    expect(result).toEqual(["glm-4-6-exacto"]);
  });

  it("keeps Google Gemma 4 deployment hints attached to Gemma 4 variants", () => {
    const models = [
      {
        id: "gemma-4-31b-it",
        slug: "google-gemma-4-31b-it",
        name: "Gemma 4 31B IT",
        provider: "Google",
      },
      {
        id: "gemma-4-26b-a4b-it",
        slug: "google-gemma-4-26b-a4b-it",
        name: "Gemma 4 26B A4B IT",
        provider: "Google",
      },
    ];

    const result = __testables.resolveHintedModelIds(
      {
        id: "google-gemma-4-launch",
        provider: "Google",
        url: "https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/",
        titleHint: "Gemma 4 open deployment launch",
        modelHints: ["Gemma 4 31B IT", "Gemma 4 26B A4B IT"],
        signalType: "open_source",
        summaryHint: "Google launched Gemma 4 under Apache 2.0 for private deployment.",
      },
      ["Gemma 4 31B IT", "Gemma 4 26B A4B IT"],
      buildModelAliasIndex(models),
      models
    );

    expect(result).toEqual(["gemma-4-31b-it", "gemma-4-26b-a4b-it"]);
  });
});
