import { describe, expect, it } from "vitest";

import { __testables } from "./official-provider-models";

describe("official provider model catalog", () => {
  it("ships canonical current records for Meta, Mistral AI, and Cohere", () => {
    const records = __testables.buildStaticRecords();
    const bySlug = new Map(records.map((record) => [record.slug, record]));

    expect(bySlug.get("meta-muse-image")).toMatchObject({
      provider: "Meta",
      status: "active",
      category: "image_generation",
      is_api_available: false,
      is_open_weights: false,
      release_date: "2026-07-07",
    });
    expect(bySlug.get("meta-muse-video")).toMatchObject({
      status: "preview",
      category: "video",
      is_api_available: false,
    });
    expect(bySlug.get("mistralai-robostral-navigate")).toMatchObject({
      provider: "Mistral AI",
      parameter_count: 8_000_000_000,
      is_api_available: false,
      release_date: "2026-07-08",
    });
    expect(bySlug.get("mistralai-mistral-medium-3-5")).toMatchObject({
      context_window: 262144,
      is_api_available: true,
      is_open_weights: true,
      release_date: "2026-04-28",
    });
    expect(bySlug.get("cohere-command-a-plus-05-2026")).toMatchObject({
      provider: "Cohere",
      parameter_count: 218_000_000_000,
      is_api_available: true,
      is_open_weights: true,
      release_date: "2026-05-20",
    });
    expect(bySlug.get("cohere-north-mini-code-1-0")).toMatchObject({
      category: "code",
      context_window: 262144,
      release_date: "2026-06-09",
    });
  });

  it("extracts model IDs only from the official Mistral IDS field", () => {
    const html = `
      <p>IDS</p><div><code>mistral-medium-3-5</code></div>
      <p>IDS</p><div><code>voxtral-mini-tts-2603</code></div>
      <a href="/models/model-cards/mistral-small-4-0-26-03">card</a>
      <p>IDS</p><div><code>/v1/chat/completions</code></div>
    `;

    expect(__testables.extractMistralCatalogIds(html)).toEqual([
      "mistral-medium-3-5",
      "voxtral-mini-tts-2603",
    ]);
  });

  it("parses Cohere's first-party model tables and lifecycle state", () => {
    const markdown = `
## Command

| Model Name | Status | Description | Modality | Context Length | Endpoints |
| --- | --- | --- | --- | --- | --- |
| \`command-current\` | Live | Current command model. | Text, Images | 128k | Chat |
| \`command-retired\` | Retired Apr 4, 2026 | Old command model. | Text | 8k | Chat |

### Using Command Models on Different Platforms

| Model Name | Azure AI Foundry |
| --- | --- |
| \`external-deployment-id\` | Deployment |

## Embed

| Model Name | Description | Modalities | Dimensions | Context Length | Endpoints |
| --- | --- | --- | --- | --- | --- |
| \`embed-current\` | Current embedding model. | Text, Images, PDFs | 1024 | 32k | Embed |
`;

    const models = __testables.parseCohereCatalog(markdown);

    expect(models).toHaveLength(3);
    expect(models.find(({ id }) => id === "command-current")?.meta).toMatchObject({
      category: "multimodal",
      context_window: 131072,
      status: "active",
      modalities: ["text", "image"],
    });
    expect(models.find(({ id }) => id === "command-retired")?.meta.status).toBe(
      "archived"
    );
    expect(models.find(({ id }) => id === "embed-current")?.meta).toMatchObject({
      category: "embeddings",
      context_window: 32768,
      modalities: ["text", "image", "file"],
    });
    expect(models.some(({ id }) => id === "external-deployment-id")).toBe(false);
  });

  it("lets curated metadata override sparse catalog discovery", () => {
    const cohereMarkdown = `
## Command

| Model Name | Status | Description | Modality | Context Length | Endpoints |
| --- | --- | --- | --- | --- | --- |
| \`command-a-plus-05-2026\` | Live | Sparse catalog description. | Text, Images | 128k | Chat |
`;
    const records = __testables.buildCatalogRecords("", cohereMarkdown);
    const command = records.find(
      (record) => record.slug === "cohere-command-a-plus-05-2026"
    );

    expect(command).toMatchObject({
      name: "Command A+",
      parameter_count: 218_000_000_000,
      release_date: "2026-05-20",
      is_open_weights: true,
    });
    expect(String(command?.description)).toContain("218B total");
  });

  it("does not overwrite unknown weight or release metadata from richer sources", () => {
    const cohereMarkdown = `
## Command

| Model Name | Status | Description | Modality | Context Length | Endpoints |
| --- | --- | --- | --- | --- | --- |
| \`future-command-model\` | Live | Newly listed model. | Text | 64k | Chat |
`;
    const records = __testables.buildCatalogRecords("", cohereMarkdown);
    const discovered = records.find(
      (record) => record.slug === "cohere-future-command-model"
    );

    expect(discovered).toMatchObject({
      status: "active",
      context_window: 65536,
      is_api_available: true,
    });
    expect(discovered).not.toHaveProperty("release_date");
    expect(discovered).not.toHaveProperty("is_open_weights");
    expect(discovered).not.toHaveProperty("license");
    expect(discovered).not.toHaveProperty("license_name");
  });
});
