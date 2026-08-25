import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/logging", () => ({
  systemLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: { write: { limit: 20, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { requireAdminSession } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PATCH } from "./route";

const mockRequireAdminSession = vi.mocked(requireAdminSession);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/admin/moderate", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
  });
}

function makeModerationClient(options?: { profileUpdateError?: string }) {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
  const profileUpdate = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({
      error: options?.profileUpdateError
        ? { message: options.profileUpdateError }
        : null,
    }),
  }));
  const notificationInsert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: USER_ID },
              error: null,
            }),
          })),
        })),
        update: profileUpdate,
      };
    }

    return { insert: notificationInsert };
  });

  return {
    client: { from, auth: { admin: { updateUserById } } },
    updateUserById,
    profileUpdate,
    notificationInsert,
  };
}

describe("PATCH /api/admin/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ user: { id: ADMIN_ID } });
  });

  it("suspends authentication and records the profile ban", async () => {
    const mocks = makeModerationClient();
    mockCreateAdminClient.mockReturnValue(mocks.client as never);

    const response = await PATCH(
      makeRequest({ action: "ban", target_type: "user", target_id: USER_ID })
    );

    expect(response.status).toBe(200);
    expect(mocks.updateUserById).toHaveBeenCalledWith(USER_ID, {
      ban_duration: "876000h",
    });
    expect(mocks.profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_banned: true })
    );
    expect(mocks.notificationInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, title: "Account suspended" })
    );
  });

  it("rolls back the auth ban when the profile update fails", async () => {
    const mocks = makeModerationClient({ profileUpdateError: "write failed" });
    mockCreateAdminClient.mockReturnValue(mocks.client as never);

    const response = await PATCH(
      makeRequest({ action: "ban", target_type: "user", target_id: USER_ID })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("suspended user's profile");
    expect(mocks.updateUserById).toHaveBeenNthCalledWith(1, USER_ID, {
      ban_duration: "876000h",
    });
    expect(mocks.updateUserById).toHaveBeenNthCalledWith(2, USER_ID, {
      ban_duration: "none",
    });
  });

  it("prevents an administrator from suspending their own account", async () => {
    const mocks = makeModerationClient();
    mockCreateAdminClient.mockReturnValue(mocks.client as never);

    const response = await PATCH(
      makeRequest({ action: "ban", target_type: "user", target_id: ADMIN_ID })
    );

    expect(response.status).toBe(400);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before authorization", async () => {
    const response = await PATCH(
      makeRequest(
        { action: "ban", target_type: "user", target_id: USER_ID },
        "https://evil.example"
      )
    );

    expect(response.status).toBe(403);
    expect(mockRequireAdminSession).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});
