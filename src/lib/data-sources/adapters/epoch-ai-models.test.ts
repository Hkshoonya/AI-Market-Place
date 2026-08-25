import { describe, expect, it } from "vitest";

import { __testables } from "./epoch-ai-models";

const EPOCH_CSV = `Model,Organization,Publication date,Link,Parameters,Training compute (FLOP),Training dataset size (total),Confidence,Abstract,Model accessibility,Base model,Last modified,Open model weights?,Domain
GLM-5.3,Z.ai (Zhipu AI),2026-08-14,https://z.ai/blog/glm-5.3,744000000000,1.2e24,28500000000000,Confident,"Frontier coding model, improved through post-training.",API access,GLM-5.2,2026-08-25 14:15:11+00:00,No,"Language,Multimodal"
Command A+,Cohere,2026-08-01,https://cohere.com/command-a-plus,111000000000,,,Likely,Updated Command family model,API access,,2026-08-20 00:00:00+00:00,No,Language`;

describe("Epoch AI model metadata adapter", () => {
  it("parses research metadata and preserves plus signs in exact model keys", () => {
    const records = __testables.parseEpochCsv(EPOCH_CSV);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      model: "GLM-5.3",
      organization: "Z.ai (Zhipu AI)",
      parameters: "744000000000",
      trainingComputeFlop: "1.2e24",
    });
    expect(__testables.normalizeEpochModelName("Command A+")).toBe("command a+");
    expect(__testables.normalizeEpochModelName("Command A")).toBe("command a");
  });

  it("requires exact normalized names and compatible providers", () => {
    const records = __testables.parseEpochCsv(EPOCH_CSV);
    const models = [
      {
        id: "glm",
        slug: "z-ai-glm-5-3",
        name: "GLM 5.3",
        provider: "Z.ai",
      },
      {
        id: "wrong-provider",
        slug: "example-glm-5-3",
        name: "GLM-5.3",
        provider: "Example Labs",
      },
      {
        id: "command-without-plus",
        slug: "cohere-command-a",
        name: "Command A",
        provider: "Cohere",
      },
    ].map((model) => ({
      ...model,
      description: null,
      parameter_count: null,
      release_date: null,
      website_url: null,
      github_url: null,
      hf_model_id: null,
      modalities: [],
    }));

    expect(__testables.matchEpochRecords(records, models)).toEqual([
      expect.objectContaining({
        model: expect.objectContaining({ id: "glm" }),
      }),
    ]);
  });

  it("maps established research-organization aliases without fuzzy model matching", () => {
    expect(
      __testables.providerMatchesEpochOrganization("Qwen", "Alibaba")
    ).toBe(true);
    expect(
      __testables.providerMatchesEpochOrganization(
        "Google",
        "Google DeepMind"
      )
    ).toBe(true);
    expect(
      __testables.providerMatchesEpochOrganization(
        "Moonshot AI",
        "Moonshot AI"
      )
    ).toBe(true);
    expect(
      __testables.providerMatchesEpochOrganization("Anthropic", "OpenAI")
    ).toBe(false);
  });

  it("fills only missing core fields and keeps source-specific facts separate", () => {
    const record = __testables.parseEpochCsv(EPOCH_CSV)[0];
    const model = {
      id: "glm",
      slug: "z-ai-glm-5-3",
      name: "GLM-5.3",
      provider: "Z.ai",
      description: "Official provider description",
      parameter_count: null,
      release_date: null,
      website_url: "https://z.ai/model-api",
      github_url: null,
      hf_model_id: null,
      modalities: ["text"],
    };

    const result = __testables.buildCoreGapPatch(
      model,
      record,
      "2026-08-25T15:00:00.000Z"
    );

    expect(result.fields).toEqual(["parameter_count", "release_date"]);
    expect(result.patch).toMatchObject({
      parameter_count: 744_000_000_000,
      release_date: "2026-08-14",
    });
    expect(result.patch).not.toHaveProperty("description");
    expect(result.patch).not.toHaveProperty("website_url");
    expect(result.patch).not.toHaveProperty("is_open_weights");
  });

  it("does not rewrite unchanged evidence just because it was observed again", () => {
    const record = __testables.parseEpochCsv(EPOCH_CSV)[0];
    const model = {
      id: "glm",
      slug: "z-ai-glm-5-3",
      name: "GLM-5.3",
      provider: "Z.ai",
      description: null,
      parameter_count: null,
      release_date: null,
      website_url: null,
      github_url: null,
      hf_model_id: null,
      modalities: [],
    };
    const candidate = __testables.buildEvidenceRecord(
      model,
      record,
      "2026-08-25T15:00:00.000Z"
    );
    const existing = {
      ...candidate,
      id: "evidence",
      observed_at: "2026-08-24T15:00:00.000Z",
      source_last_modified_at: "2026-08-25T14:15:11+00:00",
      created_at: "2026-08-24T15:00:00.000Z",
      updated_at: "2026-08-24T15:00:00.000Z",
    };

    expect(__testables.evidenceChanged(existing as never, candidate)).toBe(false);
  });
});
