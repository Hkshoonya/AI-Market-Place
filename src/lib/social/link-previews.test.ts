import { describe, expect, it } from "vitest";
import { buildLinkPreviewMetadata, buildSocialLinkPreviewsFromText, extractLinkPreviewUrls } from "./link-previews";

describe("social link previews", () => {
  it("extracts non-image URLs from post content", () => {
    expect(
      extractLinkPreviewUrls(
        "Launch note https://x.com/OpenAI/status/12345 and docs https://openai.com/index/hello but not https://example.com/image.png"
      )
    ).toEqual([
      "https://x.com/OpenAI/status/12345",
      "https://openai.com/index/hello",
    ]);
  });

  it("builds rich metadata for X links", () => {
    expect(buildLinkPreviewMetadata("https://x.com/OpenAI/status/12345")).toEqual(
      expect.objectContaining({
        source_type: "x",
        label: "X update from @OpenAI",
        handle: "OpenAI",
        tweet_id: "12345",
        action_label: "Open on X",
      })
    );
  });

  it("creates link preview rows from content", () => {
    expect(
      buildSocialLinkPreviewsFromText(
        "Track this https://github.com/openai/openai-node and this https://huggingface.co/openai/gpt-oss-20b"
      )
    ).toEqual([
      expect.objectContaining({
        url: "https://github.com/openai/openai-node",
        metadata: expect.objectContaining({ source_type: "github" }),
      }),
      expect.objectContaining({
        url: "https://huggingface.co/openai/gpt-oss-20b",
        metadata: expect.objectContaining({ source_type: "huggingface" }),
      }),
    ]);
  });
});
