import { describe, expect, it } from "vitest";

import { __testables } from "./ollama-library";

describe("ollama-library adapter", () => {
  it("extracts library slugs from the Ollama library page", () => {
    const slugs = __testables.extractLibrarySlugs(`
      <a href="/library/minimax-m2.7">MiniMax</a>
      <a href="/library/glm-5">GLM</a>
      <a href="/library/qwen3-coder">Qwen</a>
    `);

    expect(slugs).toEqual(["glm-5", "minimax-m2.7", "qwen3-coder"]);
  });

  it("parses local and cloud commands from model pages", () => {
    const parsed = __testables.parseOllamaModelPage(
      "qwen3-coder",
      `
        <html>
          <title>qwen3-coder</title>
          <meta property="og:description" content="Coding model" />
          <div>256K context window</div>
          <code>ollama run qwen3-coder:480b-cloud</code>
          <code>ollama run qwen3-coder:30b</code>
        </html>
      `
    );

    expect(parsed.title).toBe("qwen3-coder");
    expect(parsed.contextWindow).toBe("256K");
    expect(parsed.cloudCommands).toEqual(["qwen3-coder:480b-cloud"]);
    expect(parsed.localCommands).toEqual(["qwen3-coder:30b"]);
  });

  it("builds alias candidates from cloud pages", () => {
    const candidates = __testables.buildAliasCandidates({
      slug: "minimax-m2.7",
      title: "minimax-m2.7",
      description: "MiniMax coding model",
      contextWindow: "200K",
      localCommands: [],
      cloudCommands: ["minimax-m2.7:cloud"],
    });

    expect(candidates.slugCandidates).toContain("minimax-m2.7");
    expect(candidates.nameCandidates).toContain("Minimax M2.7");
  });

  it("builds deployment news records for local and cloud availability", () => {
    const records = __testables.buildNewsRecords({
      page: {
        slug: "minimax-m2.5",
        title: "MiniMax M2.5",
        description: "Open-weight reasoning model",
        contextWindow: "1M",
        localCommands: ["minimax-m2.5:latest"],
        cloudCommands: ["minimax-m2.5:cloud"],
      },
      models: [
        {
          id: "model-1",
          slug: "minimax-minimax-m2-5",
          name: "MiniMax M2.5",
          provider: "MiniMax",
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(
      expect.objectContaining({
        source: "ollama-library",
        category: "open_source",
        title: "MiniMax M2.5 is now available on Ollama",
        related_model_ids: ["model-1"],
      })
    );
    expect(records[0]?.metadata).toEqual(
      expect.objectContaining({
        signal_type: "open_source",
        local_runtime: true,
        cloud_runtime: true,
      })
    );
  });

  it("prefers exact model matches over broad family derivative matches", () => {
    const page = {
      slug: "qwen3.5",
      title: "Qwen3.5",
      description: "Base Qwen3.5 model in the Ollama library",
      contextWindow: "256K",
      localCommands: ["qwen3.5"],
      cloudCommands: [],
    };

    const selected = __testables.selectPrimaryMatchedModels(
      [
        {
          id: "base",
          slug: "alibaba-qwen3-5",
          name: "Qwen3.5",
          provider: "Alibaba",
        },
        {
          id: "derivative",
          slug: "jackrong-qwen3-5-4b-claude-4-6-opus-reasoning-distilled-gguf",
          name: "Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-GGUF",
          provider: "Jackrong",
        },
      ],
      page
    );

    expect(selected.map((model) => model.id)).toEqual(["base"]);
  });
});
