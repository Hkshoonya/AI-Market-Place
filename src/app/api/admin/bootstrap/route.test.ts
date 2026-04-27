import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/data-sources/orchestrator", () => ({
  runTierSync: vi.fn(),
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
import { runTierSync } from "@/lib/data-sources/orchestrator";
import { POST } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockRunTierSync = vi.mocked(runTierSync);

function makeSessionClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-1" } },
        error: null,
      }),
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

describe("POST /api/admin/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunTierSync.mockResolvedValue({ ok: true } as never);
  });

  it("runs the bootstrap tiers for a same-origin admin request", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/admin/bootstrap", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRunTierSync).toHaveBeenCalledTimes(4);
  });

  it("rejects cross-origin bootstrap requests", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/admin/bootstrap", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
      })
    );

    expect(response.status).toBe(403);
    expect(mockRunTierSync).not.toHaveBeenCalled();
  });
});
