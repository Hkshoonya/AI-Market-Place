import { describe, expect, it, vi } from "vitest";

const mockImageResponse = vi.fn(function MockImageResponse(
  this: Record<string, unknown>,
  element: unknown,
  options: unknown
) {
  this.element = element;
  this.options = options;
});

vi.mock("next/og", () => ({
  ImageResponse: mockImageResponse,
}));

describe("root twitter image", () => {
  it("exports the expected metadata", async () => {
    const twitterImageModule = await import("./twitter-image");

    expect(twitterImageModule.runtime).toBe("edge");
    expect(twitterImageModule.contentType).toBe("image/png");
    expect(twitterImageModule.size).toEqual({ width: 1200, height: 630 });
    expect(twitterImageModule.alt).toContain("AI Market Cap");
  });

  it("builds the twitter image response with the configured size", async () => {
    const { default: TwitterImage, size } = await import("./twitter-image");

    await TwitterImage();

    expect(mockImageResponse).toHaveBeenCalledWith(expect.anything(), size);
  });
});
