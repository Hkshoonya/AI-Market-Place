import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichDiscoveredModelDocs, parseProviderModelDocument, providerModelDocumentUrl } from "./provider-model-docs";

describe("first-party model document discovery", () => {
  afterEach(() => vi.unstubAllGlobals());
  const doc = `---\ntitle: Claude Fable 5.1\n---\n**Latest.** Released September 1, 2026.\nModel ID: \`claude-fable-5-1\`\nContext window: 1M tokens`;
  it("extracts exact identity, context and public release instead of family guesses", () => {
    expect(parseProviderModelDocument(doc, "claude-fable-5-1", "https://platform.claude.com/docs/en/models/fable-5-1/overview"))
      .toMatchObject({ name: "Claude Fable 5.1", context_window: 1000000, release_date: "2026-09-01" });
    expect(parseProviderModelDocument(doc, "claude-fable-5-2", "unused")).toBeNull();
  });
  it("reads OpenAI's format without interpreting knowledge cutoff as release date", () => {
    expect(parseProviderModelDocument("# GPT-6 Astra\nModel ID: `gpt-6-astra`\n- 1,050,000 context window\n- Apr 30, 2026 knowledge cutoff", "gpt-6-astra", "official"))
      .toEqual({ name: "GPT-6 Astra", context_window: 1050000, website_url: "official" });
  });
  it("rejects unsafe IDs and comparison mentions without an exact document identity", () => {
    expect(providerModelDocumentUrl("OpenAI", "../../admin")).toBeNull();
    expect(providerModelDocumentUrl("Anthropic", "claude-fable-5-1-system-card")).toBeNull();
    expect(parseProviderModelDocument("# Unrelated\nCompare `claude-fable-5-1`\nContext window: 1M tokens", "claude-fable-5-1", "unused")).toBeNull();
  });
  it("bounds optional fetches, prohibits redirects and skips static model requests", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const ids = ["gpt-known", ...Array.from({ length: 9 }, (_, i) => `gpt-new-${i}`)];
    const entries = await enrichDiscoveredModelDocs("OpenAI", ids, new Set(["gpt-known"]));
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
    expect(entries.map(({ id }) => id)).toEqual(ids);
  });
});
