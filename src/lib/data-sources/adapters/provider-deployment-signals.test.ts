import { describe, expect, it } from "vitest";

import { __testables } from "./provider-deployment-signals";

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
});
