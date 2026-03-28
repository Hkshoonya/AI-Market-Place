import { describe, expect, it, vi } from "vitest";

import { __testables } from "./z-ai-models";

describe("z-ai-models adapter", () => {
  it("extracts model ids from the docs sitemap", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <urlset>
          <url><loc>https://docs.z.ai/guides/llm/glm-5</loc></url>
          <url><loc>https://docs.z.ai/guides/llm/glm-5.1</loc></url>
          <url><loc>https://docs.z.ai/guides/vlm/glm-4.6v</loc></url>
          <url><loc>https://docs.z.ai/guides/overview/migrate-to-glm-new</loc></url>
        </urlset>`,
        { status: 200 }
      )
    );

    await expect(__testables.scrapeModelIds()).resolves.toEqual(["glm-4.6v", "glm-5", "glm-5.1"]);

    fetchMock.mockRestore();
  });

  it("builds canonical provider records for GLM models", () => {
    const record = __testables.buildModelRecord("glm-5");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "Z.ai",
        slug: "z-ai-glm-5",
        name: "GLM-5",
      })
    );
  });
});
