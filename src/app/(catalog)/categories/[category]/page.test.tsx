import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

describe("CategoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds category metadata for a valid category", async () => {
    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ category: "llm" }),
      })
    ).resolves.toMatchObject({
      title: "Large Language Models AI Models",
      description: expect.stringContaining("Large Language Models"),
    });
  });

  it("returns not found metadata for an unknown category", async () => {
    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ category: "unknown" }),
      })
    ).resolves.toMatchObject({
      title: "Category Not Found",
    });
  });

  it("redirects valid categories into the models filter view", async () => {
    const { default: CategoryPage } = await import("./page");

    await CategoryPage({
      params: Promise.resolve({ category: "code" }),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/models?category=code");
  });

  it("redirects invalid categories back to the model directory", async () => {
    const { default: CategoryPage } = await import("./page");

    await CategoryPage({
      params: Promise.resolve({ category: "not-real" }),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/models");
  });
});
