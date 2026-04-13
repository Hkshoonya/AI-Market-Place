import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockNotFound = vi.fn();

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

function createQuery<T>(data: T) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: T; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };
}

describe("ProviderDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("builds metadata for a valid provider slug", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() =>
        createQuery([
          { provider: "OpenAI" },
          { provider: "Anthropic" },
        ]),
      ),
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
      from: vi.fn(() => createQuery([{ provider: "OpenAI" }])),
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

  it("calls notFound for an invalid provider detail route", async () => {
    mockCreatePublicClient.mockReturnValue({
      from: vi.fn(() => createQuery([{ provider: "OpenAI" }])),
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
