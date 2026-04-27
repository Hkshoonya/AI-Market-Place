import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: { write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/data-sources/orchestrator", () => ({
  runSingleSync: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { createClient } from "@/lib/supabase/server";
import { runSingleSync } from "@/lib/data-sources/orchestrator";
import { POST } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockRunSingleSync = vi.mocked(runSingleSync);

function makeSessionClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
    },
    from: vi.fn((table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { is_admin: true },
              error: null,
            }),
          }),
        }),
      };
    }),
  };
}

describe("POST /api/admin/sync/[source]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSingleSync.mockResolvedValue({ source: "huggingface", synced: true } as never);
  });

  it("triggers a source sync for same-origin admin requests", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/admin/sync/huggingface", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      }),
      { params: Promise.resolve({ source: "huggingface" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockRunSingleSync).toHaveBeenCalledWith("huggingface");
  });

  it("rejects cross-origin source sync triggers", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/admin/sync/huggingface", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
      }),
      { params: Promise.resolve({ source: "huggingface" }) }
    );

    expect(response.status).toBe(403);
    expect(mockRunSingleSync).not.toHaveBeenCalled();
  });
});
