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
});
