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

describe("compare opengraph image", () => {
  it("exports the expected metadata and image dimensions", async () => {
    const ogImageModule = await import("./opengraph-image");

    expect(ogImageModule.runtime).toBe("edge");
    expect(ogImageModule.alt).toBe("Compare AI Models");
    expect(ogImageModule.contentType).toBe("image/png");
    expect(ogImageModule.size).toEqual({ width: 1200, height: 630 });
  });

  it("builds the og image response with the configured size", async () => {
    const { default: OGImage, size } = await import("./opengraph-image");

    await OGImage();

    expect(mockImageResponse).toHaveBeenCalledTimes(1);
    expect(mockImageResponse).toHaveBeenCalledWith(expect.anything(), size);
  });
});
