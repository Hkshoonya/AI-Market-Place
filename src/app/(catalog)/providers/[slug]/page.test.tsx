import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockNotFound = vi.fn();

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    notFound: (...args: unknown[]) => mockNotFound(...args),
  };
});

describe("ProviderDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("builds metadata for a valid provider slug", async () => {
    mockCreatePublicClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ["OpenAI", "Anthropic"], error: null }),
    });

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "openai" }),
      }),
    ).resolves.toMatchObject({
      title: "OpenAI AI Models",
      description: expect.stringContaining("OpenAI"),
      alternates: {
        canonical: expect.stringContaining("/providers/openai"),
      },
    });
  });

  it("returns not-found metadata when the provider slug does not resolve", async () => {
    mockCreatePublicClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ["OpenAI"], error: null }),
    });

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "missing" }),
      }),
    ).resolves.toMatchObject({
      title: "Provider Not Found",
    });
  });

  it("finds providers beyond the database's first 1,000 rows", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [...Array.from({ length: 1000 }, (_, i) => `Provider ${i}`), "Anthropic"],
      error: null,
    });
    mockCreatePublicClient.mockReturnValue({
      rpc,
    });
    const { generateMetadata } = await import("./page");
    await expect(generateMetadata({ params: Promise.resolve({ slug: "anthropic" }) }))
      .resolves.toMatchObject({ title: "Anthropic AI Models" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_active_provider_names");
  });

  it("calls notFound for an invalid provider detail route", async () => {
    mockCreatePublicClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ["OpenAI"], error: null }),
    });

    const { default: ProviderDetailPage } = await import("./page");

    await expect(
      ProviderDetailPage({
        params: Promise.resolve({ slug: "missing" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });
});
