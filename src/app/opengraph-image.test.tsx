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

describe("root opengraph image", () => {
  it("exports the expected metadata", async () => {
    const ogImageModule = await import("./opengraph-image");

    expect(ogImageModule.runtime).toBe("edge");
    expect(ogImageModule.contentType).toBe("image/png");
    expect(ogImageModule.size).toEqual({ width: 1200, height: 630 });
    expect(ogImageModule.alt).toContain("AI Market Cap");
  });

  it("builds the og image response with the configured size", async () => {
    const { default: OGImage, size } = await import("./opengraph-image");

    await OGImage();

    expect(mockImageResponse).toHaveBeenCalledWith(expect.anything(), size);
  });
});
