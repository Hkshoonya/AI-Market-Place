import { describe, expect, it } from "vitest";

import { generateAliases } from "../model-matcher";
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
      hasBenchmarkSignal: false,
      title: "Grok 4 Fast benchmark update",
      summary:
        "xAI published official provider-reported benchmark evidence for Grok 4 Fast.",
      publishedAt: "2025-09-19T00:00:00.000Z",
    });
  });

  it("auto-generates benchmark sources only for uncovered trusted model locators", () => {
    const sources = __testables.buildAutoBenchmarkSources(
      [
        {
          id: "1",
          slug: "google-gemma-4-31b-it",
          name: "Gemma 4 31B IT",
          provider: "Google",
          category: "multimodal",
          hf_model_id: "google/gemma-4-31B-it",
          website_url: "https://ai.google.dev/gemma/docs/model_card_4",
          release_date: "2026-04-02",
        },
        {
          id: "2",
          slug: "google-imagen-4-fast",
          name: "Imagen 4 Fast",
          provider: "Google",
          category: "image_generation",
          hf_model_id: "google/imagen-4-fast",
          website_url: null,
          release_date: "2026-04-02",
        },
        {
          id: "3",
          slug: "z-ai-glm-5-1",
          name: "GLM-5.1",
          provider: "Z.ai",
          category: "llm",
          hf_model_id: "zai-org/GLM-5.1",
          website_url: null,
          release_date: "2026-04-03",
        },
      ],
      new Set(["3"]),
      new Set<string>(),
      10
    );

    expect(sources).toHaveLength(2);
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "auto-hf-google-gemma-4-31b-it",
          provider: "Google",
          url: "https://huggingface.co/google/gemma-4-31B-it",
          requiresBenchmarkSignal: true,
          sourceType: "official_model_card",
        }),
        expect.objectContaining({
          id: "auto-web-google-gemma-4-31b-it",
          provider: "Google",
          url: "https://ai.google.dev/gemma/docs/model_card_4",
          requiresBenchmarkSignal: true,
          sourceType: "official_provider_page",
        }),
      ])
    );
    expect(sources[0].modelHints).toContain("Gemma 4 31B IT");
    expect(sources[0].modelHints).toContain("gemma-4-31B-it");
  });

  it("keeps refreshing existing auto sources for already-covered models", () => {
    const sources = __testables.buildAutoBenchmarkSources(
      [
        {
          id: "1",
          slug: "deepseek-r1",
          name: "DeepSeek R1",
          provider: "DeepSeek",
          category: "llm",
          hf_model_id: "deepseek-ai/DeepSeek-R1",
          website_url: "https://api-docs.deepseek.com/updates",
          release_date: "2026-01-20",
        },
      ],
      new Set(["1"]),
      new Set(["provider-benchmarks-auto-web-deepseek-r1"]),
      10
    );

    expect(sources).toEqual([
      expect.objectContaining({
        id: "auto-web-deepseek-r1",
        provider: "DeepSeek",
        url: "https://api-docs.deepseek.com/updates",
        sourceType: "official_provider_page",
      }),
    ]);
  });

  it("falls back to trusted official provider pages when HF cards are unavailable", () => {
    const sources = __testables.buildAutoBenchmarkSources(
      [
        {
          id: "1",
          slug: "x-ai-grok-4-20",
          name: "Grok 4.20",
          provider: "xAI",
          category: "multimodal",
          hf_model_id: null,
          website_url: "https://docs.x.ai/docs/models",
          release_date: "2026-03-31",
        },
        {
          id: "2",
          slug: "minimax-speech-2-8-hd",
          name: "MiniMax Speech 2.8 HD",
          provider: "MiniMax",
          category: "speech_audio",
          hf_model_id: null,
          website_url: "https://www.minimax.io/models/audio",
          release_date: "2026-02-05",
        },
      ],
      new Set<string>(),
      new Set<string>(),
      10
    );

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "auto-web-x-ai-grok-4-20",
          provider: "xAI",
          url: "https://docs.x.ai/docs/models",
          sourceType: "official_provider_page",
          requiresBenchmarkSignal: true,
        }),
        expect.objectContaining({
          id: "auto-web-minimax-speech-2-8-hd",
          provider: "MiniMax",
          url: "https://www.minimax.io/models/audio",
          sourceType: "official_provider_page",
          requiresBenchmarkSignal: true,
        }),
      ])
    );
  });

  it("combines curated hints with text-resolved model matches", () => {
    const aliasModels = [
      {
        id: "gemma-family",
        slug: "google-gemma-4",
        name: "Gemma 4",
        provider: "Google",
      },
      {
        id: "gemma-31b-it",
        slug: "google-gemma-4-31b-it",
        name: "Gemma 4 31B IT",
        provider: "Google",
      },
    ];
    const aliasIndex = __testables.buildModelAliasIndex(aliasModels);
    const lookup = [
      {
        id: "gemma-31b-it",
        slug: "google-gemma-4-31b-it",
        name: "Gemma 4 31B IT",
        provider: "Google",
        aliases: generateAliases("Gemma 4 31B IT"),
      },
      {
        id: "gemma-family",
        slug: "google-gemma-4",
        name: "Gemma 4",
        provider: "Google",
        aliases: generateAliases("Gemma 4"),
      },
    ];

    const relatedModelIds = __testables.buildModelRelations(
      {
        id: "google-gemma-4-launch",
        provider: "Google",
        url: "https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/",
        titleHint: "Gemma 4 benchmark update",
        modelHints: ["Gemma 4"],
      },
      "Gemma 4 benchmark update",
      "Google reports benchmark gains for Gemma 4 31B IT.",
      lookup,
      aliasIndex
    );

    expect(relatedModelIds).toEqual(["gemma-family", "gemma-31b-it"]);
  });

  it("keeps exact hint matches when another hint is too broad", () => {
    const exactModels = [
      ["base", "openai-gpt-5-3", "GPT-5.3"],
      ["codex", "openai-gpt-5-3-codex", "GPT-5.3"],
      ["chat-latest", "openai-gpt-5-3-chat-latest", "GPT-5.3"],
    ] as const;
    const broadFamilyModels = [
      ["gpt-5", "openai-gpt-5", "GPT-5"],
      ["gpt-5-pro", "openai-gpt-5-pro", "GPT-5"],
      ["gpt-5-codex", "openai-gpt-5-codex", "GPT-5"],
      ["gpt-5-chat", "openai-gpt-5-chat-latest", "GPT-5"],
      ["gpt-5-dated", "openai-gpt-5-2025-08-07", "GPT-5"],
      ["gpt-5-pro-dated", "openai-gpt-5-pro-2025-10-06", "GPT-5"],
    ] as const;
    const aliasModels = [...exactModels, ...broadFamilyModels].map(
      ([id, slug, name]) => ({
        id,
        slug,
        name,
        provider: "OpenAI",
      })
    );
    const aliasIndex = __testables.buildModelAliasIndex(aliasModels);
    const lookup = aliasModels.map((model) => ({
      ...model,
      aliases: generateAliases(model.name),
    }));

    const relatedModelIds = __testables.buildModelRelations(
      {
        id: "openai-gpt-5-3-instant",
        provider: "OpenAI",
        url: "https://deploymentsafety.openai.com/gpt-5-3-instant/gpt-5-3-instant.pdf",
        titleHint: "GPT-5.3 Instant benchmark update",
        modelHints: ["GPT-5.3", "GPT-5.3 Instant"],
        contentType: "pdf",
      },
      "GPT-5.3 Instant System Card",
      "OpenAI reports benchmark evaluations for GPT-5.3 Instant.",
      lookup,
      aliasIndex
    );

    expect(relatedModelIds).toEqual(["base", "codex", "chat-latest"]);
  });

  it("prefers curated hint matches when source text is noisy navigation", () => {
    const aliasModels = [
      {
        id: "target",
        slug: "z-ai-glm-5v-turbo",
        name: "GLM-5V-Turbo",
        provider: "Z.ai",
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `noise-${index}`,
        slug: `z-ai-glm-noise-${index}`,
        name: `GLM Noise ${index}`,
        provider: "Z.ai",
      })),
    ];
    const aliasIndex = __testables.buildModelAliasIndex(aliasModels);
    const lookup = aliasModels.map((model) => ({
      ...model,
      aliases: generateAliases(model.name),
    }));

    const relatedModelIds = __testables.buildModelRelations(
      {
        id: "zai-glm-5v-turbo",
        provider: "Z.ai",
        url: "https://docs.z.ai/guides/vlm/glm-5v-turbo",
        titleHint: "GLM-5V-Turbo benchmark update",
        modelHints: ["GLM-5V-Turbo"],
      },
      "GLM-5V-Turbo - Overview - Z.AI DEVELOPER DOCUMENT",
      "Navigation Vision Language Models GLM-5V-Turbo GLM Noise 0 GLM Noise 1 GLM Noise 2 GLM Noise 3 GLM Noise 4 GLM Noise 5 GLM Noise 6 GLM Noise 7 GLM Noise 8 benchmark overview.",
      lookup,
      aliasIndex
    );

    expect(relatedModelIds).toEqual(["target"]);
  });
});
