import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("GET /api/models/[slug]/description", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a catalog fallback overview when the model exists but has no saved description", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "models") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "model-1",
              slug: "openai-o3",
              name: "o3",
              provider: "OpenAI",
              category: "llm",
              description: null,
              short_description: null,
              is_open_weights: false,
              context_window: 200000,
              capabilities: { reasoning: true, coding: true },
            },
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
        }),
      };
    });

    mockCreateClient.mockResolvedValue({ from: fromMock } as never);

    const response = await GET(new Request("http://localhost/api/models/test/description") as never, {
      params: Promise.resolve({ slug: "test-model" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        generated_by: "catalog_fallback",
        summary: expect.stringMatching(/reasoning model/i),
      })
    );
  });
});
