import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logging", () => ({
  systemLog: { error: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { requireAdminSession } from "./require-admin";

const mockCreateClient = vi.mocked(createClient);

function makeClient(options: {
  userId?: string;
  authError?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  profileError?: boolean;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.userId ? { id: options.userId } : null },
        error: options.authError ? { message: "invalid session" } : null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: options.profileError
          ? null
          : {
              is_admin: options.isAdmin ?? false,
              is_banned: options.isBanned ?? false,
            },
        error: options.profileError ? { message: "database unavailable" } : null,
      }),
    })),
  };
}

describe("requireAdminSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without an authenticated user", async () => {
    mockCreateClient.mockResolvedValue(makeClient({}) as never);

    const result = await requireAdminSession();

    expect(result.error?.status).toBe(401);
  });

  it("rejects banned administrators", async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ userId: "admin-1", isAdmin: true, isBanned: true }) as never
    );

    const result = await requireAdminSession();

    expect(result.error?.status).toBe(403);
  });

  it("returns the verified administrator identity", async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ userId: "admin-1", isAdmin: true }) as never
    );

    await expect(requireAdminSession()).resolves.toEqual({
      user: { id: "admin-1" },
    });
  });

  it("fails closed when the profile lookup fails", async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ userId: "admin-1", profileError: true }) as never
    );

    const result = await requireAdminSession();

    expect(result.error?.status).toBe(500);
  });
});
