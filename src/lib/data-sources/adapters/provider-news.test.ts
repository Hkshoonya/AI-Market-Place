import { describe, expect, it } from "vitest";

import { __testables } from "./provider-news";
import { classifyNewsSignal } from "@/lib/news/signals";

describe("provider-news health aggregation", () => {
  it("treats the source as healthy when at least one provider blog is reachable", () => {
    const summary = __testables.summarizeHealthChecks([
      { name: "OpenAI", ok: false, status: 403, latencyMs: 120 },
      { name: "Anthropic", ok: true, status: 200, latencyMs: 95 },
      { name: "Google", ok: false, status: 500, latencyMs: 200 },
    ]);

    expect(summary).toEqual(
      expect.objectContaining({
        healthy: true,
      })
    );
    expect(summary.message).toContain("1/3");
  });

  it("classifies pricing headlines consistently with X updates", () => {
    const signal = classifyNewsSignal("New API pricing for Claude with lower cost per million tokens");

    expect(signal).toEqual(
      expect.objectContaining({
        signalType: "pricing",
        category: "pricing",
        importance: "high",
      })
    );
  });

  it("treats GLM and MiniMax launch headlines as model-related", () => {
    expect(__testables.isModelRelated("GLM-5.1 in Coding Agent is now available")).toBe(true);
    expect(__testables.isModelRelated("MiniMax M2.7 launch for coding agents")).toBe(true);
  });

  it("tracks provider blogs and official feed fallbacks for fragile sources", () => {
    expect(__testables.providerBlogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "DeepSeek", url: "https://api-docs.deepseek.com/updates/" }),
        expect.objectContaining({
          provider: "Google",
          rssUrl: "https://blog.google/innovation-and-ai/technology/ai/rss/",
        }),
        expect.objectContaining({
          provider: "Stability AI",
          rssUrl: "https://stability.ai/news-updates?format=rss",
        }),
        expect.objectContaining({ provider: "Z.ai" }),
        expect.objectContaining({ provider: "MiniMax" }),
      ])
    );
  });

  it("treats Cloudflare challenge responses as warnings instead of hard provider failures", () => {
    const response = new Response("", {
      status: 403,
      headers: {
        "cf-mitigated": "challenge",
        server: "cloudflare",
      },
    });

    expect(__testables.isBotChallengeResponse(response)).toBe(true);
  });

  it("extracts structured Z.ai release-note entries instead of the generic page title", () => {
    const html = `
      <div data-component-part="update-label">2026-03-27</div>
      <div class="px-1" data-component-part="update-description">  GLM-5.1 in Coding Agent</div>
      <div class="prose-sm"><ul><li><a href="/devpack/claude-code">documentation</a></li></ul></div>
    `;

    expect(__testables.parseZaiReleaseNotes(html, "https://docs.z.ai/release-notes/new-released")).toEqual([
      {
        date: "2026-03-27T00:00:00.000Z",
        title: "GLM-5.1 in Coding Agent",
        url: "https://docs.z.ai/devpack/claude-code",
      },
    ]);
  });

  it("parses official RSS items for provider-news fallback ingestion", () => {
    const xml = `
      <rss version="2.0">
        <channel>
          <item>
            <title><![CDATA[Introducing GPT-5.4 for developers]]></title>
            <link>https://openai.com/index/introducing-gpt-5-4</link>
            <pubDate>Tue, 24 Mar 2026 09:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    expect(__testables.parseRssArticles(xml)).toEqual([
      {
        title: "Introducing GPT-5.4 for developers",
        url: "https://openai.com/index/introducing-gpt-5-4",
        date: "2026-03-24T09:00:00.000Z",
      },
    ]);
  });

  it("falls back to a date embedded in the article title when listing metadata omits it", () => {
    expect(
      __testables.inferPublishedAt({
        url: "https://www.anthropic.com/news/claude-opus-4-6",
        title:
          "Announcements Feb 5, 2026 Introducing Claude Opus 4.6 We’re upgrading our smartest model.",
        date: null,
      })
    ).toBe("2026-02-05T00:00:00.000Z");
  });
});
