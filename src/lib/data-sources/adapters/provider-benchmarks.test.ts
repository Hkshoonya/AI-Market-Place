import { describe, expect, it } from "vitest";

import { __testables } from "./provider-benchmarks";

const SAMPLE_HTML = `
  <html>
    <head>
      <title>GLM-4.5 benchmark update</title>
      <meta name="description" content="GLM-4.5 reaches new benchmark highs across coding and reasoning leaderboards." />
      <meta property="article:published_time" content="2026-03-20T00:00:00.000Z" />
    </head>
    <body>
      <article>
        <p>GLM-4.5 improves benchmark performance on coding and reasoning tasks.</p>
        <p>The leaderboard gains include stronger AIME and SWE-Bench results.</p>
      </article>
    </body>
  </html>
`;

const SAMPLE_PDF_TEXT = `
Grok 4 Fast Model Card
xAI
Last updated: September 19, 2025
Introduction
Grok 4 Fast offers reasoning capabilities near the level of Grok 4 with lower latency and cost.
Evaluations
We evaluated Grok 4 Fast on abuse potential, coding, agent, and leaderboard-style reasoning tasks.
`;

const SAMPLE_SERVICE_CARD_TEXT = `
Amazon Nova 2 Lite
Overview of Amazon Nova 2 Lite
We use multiple datasets and human teams to evaluate the performance of Amazon Nova 2 Lite.
Customers can establish a benchmark effectiveness score with multiple judgements per prompt.
Deployment and performance optimization best practices
`;

describe("provider-benchmarks helpers", () => {
  it("extracts official page metadata for provider benchmark evidence", () => {
    expect(__testables.extractTitle(SAMPLE_HTML)).toBe(
      "GLM-4.5 benchmark update"
    );
    expect(__testables.extractDescription(SAMPLE_HTML)).toContain("benchmark");
    expect(__testables.extractPublishedAt(SAMPLE_HTML)).toBe(
      "2026-03-20T00:00:00.000Z"
    );
  });

  it("extracts a benchmark-focused snippet from page body text", () => {
    expect(__testables.extractBenchmarkSnippet(SAMPLE_HTML)).toContain(
      "benchmark performance"
    );
    expect(__testables.extractBenchmarkSnippet(SAMPLE_HTML)).toContain(
      "SWE-Bench"
    );
  });

  it("prefers benchmark body text over generic page descriptions", () => {
    expect(
      __testables.extractBenchmarkSnippet(SAMPLE_HTML)
    ).toContain("benchmark performance");
    expect(__testables.extractDescription(SAMPLE_HTML)).toContain(
      "benchmark highs"
    );
  });

  it("extracts title, date, and benchmark summary from provider PDF text", () => {
    expect(__testables.extractPdfTitle(SAMPLE_PDF_TEXT)).toBe(
      "Grok 4 Fast Model Card"
    );
    expect(
      __testables.extractPdfPublishedAt(
        {
          id: "xai-grok-4-fast",
          provider: "xAI",
          url: "https://data.x.ai/2025-09-19-grok-4-fast-model-card.pdf",
          titleHint: "Grok 4 Fast benchmark update",
          modelHints: ["Grok 4 Fast"],
          contentType: "pdf",
        },
        SAMPLE_PDF_TEXT
      )
    ).toBe("2025-09-19T00:00:00.000Z");
    expect(
      __testables.extractPdfSummary(
        {
          id: "xai-grok-4-fast",
          provider: "xAI",
          url: "https://data.x.ai/2025-09-19-grok-4-fast-model-card.pdf",
          titleHint: "Grok 4 Fast benchmark update",
          modelHints: ["Grok 4 Fast"],
          contentType: "pdf",
        },
        SAMPLE_PDF_TEXT
      )
    ).toContain("leaderboard-style reasoning tasks");
  });

  it("falls back to source hints when PDF text is flattened into a long first line", () => {
    const flattened =
      "Amazon Nova 2 Lite AWS AI Service Cards Copyright 2026 Amazon Web Services, Inc. and/or its affiliates. All rights reserved. Table of Contents Overview Intended use cases and limitations.";

    expect(__testables.extractPdfTitle(flattened)).toBeNull();
  });

  it("prefers evaluation-focused lines when building PDF summaries", () => {
    expect(
      __testables.extractPdfSummary(
        {
          id: "amazon-nova-2-lite",
          provider: "Amazon",
          url: "https://docs.aws.amazon.com/pdfs/ai/responsible-ai/nova-2-lite/nova-2-lite.pdf",
          titleHint: "Nova 2 Lite benchmark update",
          modelHints: ["Nova 2 Lite", "Amazon Nova 2 Lite"],
          contentType: "pdf",
        },
        SAMPLE_SERVICE_CARD_TEXT
      )
    ).toContain("benchmark effectiveness score");
    expect(
      __testables.extractPdfSummary(
        {
          id: "amazon-nova-2-lite",
          provider: "Amazon",
          url: "https://docs.aws.amazon.com/pdfs/ai/responsible-ai/nova-2-lite/nova-2-lite.pdf",
          titleHint: "Nova 2 Lite benchmark update",
          modelHints: ["Nova 2 Lite", "Amazon Nova 2 Lite"],
          contentType: "pdf",
        },
        SAMPLE_SERVICE_CARD_TEXT
      )
    ).not.toContain("Deployment and performance optimization best practices");
  });

  it("falls back to generic provider benchmark copy for noisy extracted summaries", () => {
    expect(
      __testables.extractPdfSummary(
        {
          id: "zai-glm-asr-2512",
          provider: "Z.ai",
          url: "https://huggingface.co/zai-org/GLM-ASR-Nano-2512",
          titleHint: "GLM ASR 2512 benchmark update",
          modelHints: ["GLM ASR 2512"],
          contentType: "pdf",
        },
        "Hugging Face Models Datasets Spaces chat_template <|im_start|>"
      )
    ).toBe("Z.ai published benchmark or leaderboard evidence for GLM ASR 2512.");
  });

  it("falls back to source hints when PDF parsing is unavailable", () => {
    expect(
      __testables.buildPdfFallbackRecord({
        id: "xai-grok-4-fast",
        provider: "xAI",
        url: "https://data.x.ai/2025-09-19-grok-4-fast-model-card.pdf",
        titleHint: "Grok 4 Fast benchmark update",
        modelHints: ["Grok 4 Fast"],
        contentType: "pdf",
      })
    ).toEqual({
      title: "Grok 4 Fast benchmark update",
      summary:
        "xAI published official provider-reported benchmark evidence for Grok 4 Fast.",
      publishedAt: "2025-09-19T00:00:00.000Z",
    });
  });
});
