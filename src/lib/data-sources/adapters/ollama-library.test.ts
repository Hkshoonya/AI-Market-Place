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
});
