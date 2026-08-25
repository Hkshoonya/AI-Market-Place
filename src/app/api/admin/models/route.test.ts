import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  systemLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: {
    api: { limit: 60, windowMs: 60_000 },
    write: { limit: 20, windowMs: 60_000 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { requireAdminSession } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, PATCH } from "./route";

const mockRequireAdminSession = vi.mocked(requireAdminSession);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const MODEL_ID = "33333333-3333-4333-8333-333333333333";

function request(
  method: "GET" | "PATCH",
  body?: unknown,
  origin = "http://localhost"
) {
  return new NextRequest("http://localhost/api/admin/models?page=1&status=active", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json", origin } : undefined,
  });
}

describe("admin models route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("returns paginated models through the service client", async () => {
    const builder = {
      eq: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    builder.eq.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.range.mockResolvedValue({
      data: [{ id: MODEL_ID, slug: "test-model", name: "Test Model", status: "active" }],
      count: 1,
      error: null,
    });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn(() => builder) })),
    } as never);

    const response = await GET(request("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(1);
    expect(body.models[0]).toMatchObject({ id: MODEL_ID, status: "active" });
    expect(builder.eq).toHaveBeenCalledWith("status", "active");
  });

  it("updates a model to a real database status", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: MODEL_ID, status: "archived" },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      request("PATCH", { id: MODEL_ID, status: "archived" })
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "archived" })
    );
  });

  it("rejects nonexistent model statuses", async () => {
    const response = await PATCH(
      request("PATCH", { id: MODEL_ID, status: "inactive" })
    );

    expect(response.status).toBe(400);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes before authorization", async () => {
    const response = await PATCH(
      request(
        "PATCH",
        { id: MODEL_ID, status: "archived" },
        "https://evil.example"
      )
    );

    expect(response.status).toBe(403);
    expect(mockRequireAdminSession).not.toHaveBeenCalled();
  });
});
