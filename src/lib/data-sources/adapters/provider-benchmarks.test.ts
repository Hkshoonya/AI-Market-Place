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

const SAMPLE_STRUCTURED_BENCHMARK_TEXT = `
Gemini 3.1 Flash-Lite achieves an impressive Elo score of 1432 on the Arena.ai Leaderboard
and outperforms other models of similar tier across reasoning and multimodal understanding benchmarks,
including 86.9% on GPQA Diamond and 76.8% on MMMU Pro.
`;

const SAMPLE_BENCHMARK_FIRST_TEXT = `
Provider evaluations show strong coding gains: SWE-Bench Verified: 74.5% and Terminal-Bench 2.0: 61.2%.
`;

const SAMPLE_OPENAI_STYLE_TEXT = `
GPT-5.4 achieves a leading 67.3% success rate on the WebArena-Verified benchmark.
SWE-Bench Pro (Public) 57.7% and Tau2-Bench Telecom 98.9% remain strong.
`;

const SAMPLE_FOOTNOTE_TEXT = `
Success rate, far exceeding GPT-5.2's 47.3%, and surpassing human performance at 72.4%. 1 On WebArena-Verified,
which tests browser use, GPT-5.4 achieves a leading 67.3% success rate when using screenshots only.
`;

const SAMPLE_ANTHROPIC_OPUS_47_TEXT = `
Based on our internal research-agent benchmark, Claude Opus 4.7 has the strongest efficiency baseline we've seen for multi-step work.
It tied for the top overall score across our six modules at 0.715 and delivered the most consistent long-context performance of any model we tested.
On General Finance—our largest module—it improved meaningfully on Opus 4.6, scoring 0.813 versus 0.767.
Claude Opus 4.7 demonstrates strong substantive accuracy on BigLaw Bench for Harvey, scoring 90.9% at high effort.
On CursorBench, Opus 4.7 is a meaningful jump in capabilities, clearing 70% versus Opus 4.6 at 58%.
For the computer-use work that sits at the heart of XBOW’s autonomous penetration testing, the new Claude Opus 4.7 is a step change:
98.5% on our visual-acuity benchmark versus 54.5% for Opus 4.6.
`;

const SAMPLE_KIMI_TABLE_HTML = `
  <html>
    <body>
      <table>
        <tr>
          <th>Benchmark</th>
          <th>Kimi K2.6</th>
          <th>GPT-5.4 (xhigh)</th>
          <th>Claude Opus 4.6 (max effort)</th>
        </tr>
        <tr>
          <td>SWE-Bench Pro</td>
          <td>58.6</td>
          <td>57.7</td>
          <td>53.4</td>
        </tr>
        <tr>
          <td>LiveCodeBench (v6)</td>
          <td>89.6</td>
          <td>88.8</td>
          <td>91.7</td>
        </tr>
        <tr>
          <td>GPQA-Diamond</td>
          <td>90.5</td>
          <td>92.8</td>
          <td>91.3</td>
        </tr>
      </table>
    </body>
  </html>
`;

const SAMPLE_GLM_TABLE_HTML = `
  <html>
    <body>
      <table>
        <tr>
          <th>GLM-5.1</th>
          <th>GLM-5</th>
          <th>Claude Opus 4.6</th>
        </tr>
        <tr>
          <td>AIME 2026</td>
          <td>95.3</td>
          <td>95.4</td>
          <td>95.6</td>
        </tr>
        <tr>
          <td>GPQA-Diamond</td>
          <td>86.2</td>
          <td>86.0</td>
          <td>91.3</td>
        </tr>
        <tr>
          <td>SWE-Bench Pro</td>
          <td>58.4</td>
          <td>55.1</td>
          <td>57.3</td>
        </tr>
        <tr>
          <td>Terminal-Bench 2.0 (Terminus-2)</td>
          <td>63.5</td>
          <td>61.9</td>
          <td>57.3</td>
        </tr>
      </table>
    </body>
  </html>
`;

const SAMPLE_META_TABLE_HTML = `
  <html>
    <body>
      <table>
        <tr>
          <th>Category</th>
          <th>Benchmark</th>
          <th># Shots</th>
          <th>Metric</th>
          <th>Llama 3 8B</th>
          <th>Llama 3.1 8B</th>
          <th>Llama 3.1 405B</th>
        </tr>
        <tr>
          <td>General</td>
          <td>MMLU</td>
          <td>5</td>
          <td>macro_avg/acc_char</td>
          <td>66.7</td>
          <td>66.7</td>
          <td>85.2</td>
        </tr>
        <tr>
          <td>General</td>
          <td>IFEval</td>
          <td>0</td>
          <td>acc</td>
          <td>76.8</td>
          <td>80.4</td>
          <td>88.6</td>
        </tr>
        <tr>
          <td>Reasoning</td>
          <td>GPQA</td>
          <td>0</td>
          <td>em</td>
          <td>34.6</td>
          <td>30.4</td>
          <td>50.7</td>
        </tr>
        <tr>
          <td>Code</td>
          <td>HumanEval</td>
          <td>0</td>
          <td>pass@1</td>
          <td>60.4</td>
          <td>72.6</td>
          <td>89.0</td>
        </tr>
      </table>
    </body>
  </html>
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

  it("extracts structured benchmark scores from provider benchmark text", () => {
    expect(__testables.extractStructuredBenchmarkScores(SAMPLE_STRUCTURED_BENCHMARK_TEXT)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "chatbot_arena_elo",
          score: 1432,
        }),
        expect.objectContaining({
          benchmarkSlug: "gpqa",
          score: 86.9,
        }),
        expect.objectContaining({
          benchmarkSlug: "mmmu",
          score: 76.8,
        }),
      ])
    );
  });

  it("extracts benchmark-first percentage patterns conservatively", () => {
    expect(__testables.extractStructuredBenchmarkScores(SAMPLE_BENCHMARK_FIRST_TEXT)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "swe-bench-verified",
          score: 74.5,
        }),
        expect.objectContaining({
          benchmarkSlug: "terminal-bench",
          score: 61.2,
        }),
      ])
    );
  });

  it("extracts current OpenAI benchmark labels without footnote false positives", () => {
    expect(__testables.extractStructuredBenchmarkScores(SAMPLE_OPENAI_STYLE_TEXT)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "webarena",
          score: 67.3,
        }),
        expect.objectContaining({
          benchmarkSlug: "swe_bench",
          score: 57.7,
        }),
        expect.objectContaining({
          benchmarkSlug: "tau-bench",
          score: 98.9,
        }),
      ])
    );
  });

  it("does not misread footnote markers as benchmark scores", () => {
    const extracted = __testables.extractStructuredBenchmarkScores(SAMPLE_FOOTNOTE_TEXT);
    expect(extracted).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "webarena",
          score: 1,
        }),
      ])
    );
  });

  it("extracts absolute Anthropic Opus 4.7 benchmark metrics conservatively", () => {
    expect(__testables.extractStructuredBenchmarkScores(SAMPLE_ANTHROPIC_OPUS_47_TEXT)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "research-agent",
          score: 0.715,
          scoreNormalized: 71.5,
        }),
        expect.objectContaining({
          benchmarkSlug: "finance-agent",
          score: 0.813,
          scoreNormalized: 81.3,
        }),
        expect.objectContaining({
          benchmarkSlug: "biglaw-bench",
          score: 90.9,
        }),
        expect.objectContaining({
          benchmarkSlug: "cursorbench",
          score: 70,
        }),
        expect.objectContaining({
          benchmarkSlug: "visual-acuity-benchmark",
          score: 98.5,
        }),
      ])
    );
  });

  it("extracts benchmark rows from provider HTML tables using the focused model column", async () => {
    const extracted =
      await __testables.extractStructuredBenchmarkScoresFromHtmlTables(
        {
          id: "moonshot-kimi-k2-6-tech-blog",
          provider: "Moonshot AI",
          url: "https://www.kimi.com/blog/kimi-k2-6",
          titleHint: "Kimi K2.6 benchmark update",
          modelHints: ["Kimi K2.6", "kimi-k2.6", "K2.6"],
        },
        SAMPLE_KIMI_TABLE_HTML
      );

    expect(extracted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "swe_bench",
          score: 58.6,
        }),
        expect.objectContaining({
          benchmarkSlug: "livecodebench",
          score: 89.6,
        }),
        expect.objectContaining({
          benchmarkSlug: "gpqa",
          score: 90.5,
        }),
      ])
    );
  });

  it("extracts benchmark rows from model-only comparison headers", async () => {
    const extracted =
      await __testables.extractStructuredBenchmarkScoresFromHtmlTables(
        {
          id: "zai-glm-5-1",
          provider: "Z.ai",
          url: "https://huggingface.co/zai-org/GLM-5.1",
          titleHint: "GLM-5.1 benchmark update",
          modelHints: ["GLM-5.1", "GLM 5.1"],
        },
        SAMPLE_GLM_TABLE_HTML
      );

    expect(extracted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "gpqa",
          score: 86.2,
        }),
        expect.objectContaining({
          benchmarkSlug: "swe_bench",
          score: 58.4,
        }),
        expect.objectContaining({
          benchmarkSlug: "terminal-bench",
          score: 63.5,
        }),
      ])
    );
  });

  it("extracts benchmark rows when the model column is at the end of the table", async () => {
    const extracted =
      await __testables.extractStructuredBenchmarkScoresFromHtmlTables(
        {
          id: "auto-hf-meta-meta-llama-3-1-405b-instruct",
          provider: "Meta",
          url: "https://huggingface.co/meta-llama/Llama-3.1-405B-Instruct",
          titleHint: "Llama 3.1 405B Instruct benchmark update",
          modelHints: [
            "Llama 3.1 405B Instruct",
            "Llama-3.1-405B-Instruct",
            "meta-llama-3.1-405b-instruct",
          ],
        },
        SAMPLE_META_TABLE_HTML
      );

    expect(extracted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          benchmarkSlug: "mmlu",
          score: 85.2,
        }),
        expect.objectContaining({
          benchmarkSlug: "ifeval",
          score: 88.6,
        }),
        expect.objectContaining({
          benchmarkSlug: "gpqa",
          score: 50.7,
        }),
        expect.objectContaining({
          benchmarkSlug: "humaneval",
          score: 89.0,
        }),
      ])
    );
  });

  it("keeps Claude Opus 4.7 in the curated provider benchmark watchlist", () => {
    expect(__testables.PROVIDER_BENCHMARK_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "anthropic-claude-opus-4-7",
          provider: "Anthropic",
          url: "https://www.anthropic.com/news/claude-opus-4-7",
          modelHints: ["Claude Opus 4.7"],
        }),
      ])
    );
  });

  it("keeps Gemini 3.1 Pro in the curated provider benchmark watchlist", () => {
    expect(__testables.PROVIDER_BENCHMARK_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "google-gemini-3-1-pro",
          provider: "Google",
          url:
            "https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/",
          requiresBenchmarkSignal: true,
          modelHints: ["Gemini 3.1 Pro"],
        }),
      ])
    );
  });

  it("keeps Kimi K2.6 in the curated provider benchmark watchlist", () => {
    expect(__testables.PROVIDER_BENCHMARK_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "moonshot-kimi-k2-6-tech-blog",
          provider: "Moonshot AI",
          url: "https://www.kimi.com/blog/kimi-k2-6",
          modelHints: ["Kimi K2.6", "kimi-k2.6", "K2.6"],
        }),
      ])
    );
  });

  it("auto-generates benchmark sources for models below the trusted benchmark coverage target", () => {
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
      new Map([["3", 4]]),
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
      new Map([["1", 4]]),
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
          slug: "openai-whisper-1",
          name: "Whisper",
          provider: "OpenAI",
          category: "speech_audio",
          hf_model_id: null,
          website_url:
            "https://developers.openai.com/api/docs/guides/speech-to-text",
          release_date: "2024-09-01",
        },
      ],
      new Map<string, number>(),
      new Set<string>(),
      10
    );

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "auto-web-x-ai-grok-4-20",
          provider: "xAI",
          url: "https://data.x.ai/2025-08-20-grok-4-model-card.pdf",
          sourceType: "official_provider_page",
          requiresBenchmarkSignal: true,
        }),
        expect.objectContaining({
          id: "auto-web-openai-whisper-1",
          provider: "OpenAI",
          url: "https://developers.openai.com/api/docs/guides/speech-to-text",
          sourceType: "official_provider_page",
          requiresBenchmarkSignal: true,
        }),
      ])
    );
  });

  it("keeps generating auto sources for official models with only partial trusted benchmark coverage", () => {
    const sources = __testables.buildAutoBenchmarkSources(
      [
        {
          id: "1",
          slug: "meta-meta-llama-3-1-405b-instruct",
          name: "Llama 3.1 405B Instruct",
          provider: "Meta",
          category: "llm",
          hf_model_id: "meta-llama/Llama-3.1-405B-Instruct",
          website_url: null,
          release_date: "2024-07-23",
        },
      ],
      new Map([["1", 2]]),
      new Set<string>(),
      10
    );

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "auto-hf-meta-meta-llama-3-1-405b-instruct",
          provider: "Meta",
          url: "https://huggingface.co/meta-llama/Llama-3.1-405B-Instruct",
          sourceType: "official_model_card",
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
