/**
 * Tests for GET /api/admin/sync
 *
 * Covers:
 * - No auth => 401
 * - Non-admin user => 403
 * - No source param => returns last 50 jobs (backward compatible)
 * - source=X => query filtered by source slug
 * - limit=10 => query limited to 10 results
 * - source + limit combined => both filters applied
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock Sentry ───────────────────────────────────────────────────────────────
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// ── Mock logging ──────────────────────────────────────────────────────────────
vi.mock("@/lib/logging", () => ({
  systemLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ── Mock rate-limit (always allow in tests) ────────────────────────────────────
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: { public: { limit: 60, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

// ── Mock createClient ─────────────────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/admin/sync");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url);
}

interface MockSyncJob {
  id: string;
  source: string;
  status: string;
  created_at: string;
}

function makeSyncJobs(sources: string[]): MockSyncJob[] {
  return sources.map((source, i) => ({
    id: `job-${i}`,
    source,
    status: "completed",
    created_at: new Date().toISOString(),
  }));
}

/**
 * Creates a mock Supabase client that tracks query calls.
 * Captures .eq() calls so we can assert on filter usage.
 * Captures .limit() call value so we can assert on limit.
 */
function createMockSupabaseClient(options: {
  user: { id: string } | null;
  isAdmin: boolean;
  syncJobs?: MockSyncJob[];
}) {
  // Track calls made to the query builder
  const calls: { method: string; args: unknown[] }[] = [];

  function makeQueryChain(returnData: unknown): Record<string, unknown> {
    const chain: Record<string, unknown> = {};

    const methods = ["select", "order", "limit", "eq", "from", "single"];
    for (const m of methods) {
      chain[m] = (...args: unknown[]) => {
        calls.push({ method: m, args });
        if (m === "single") {
          // Profiles single() call - return admin status
          return Promise.resolve({
            data: options.isAdmin ? { is_admin: true } : { is_admin: false },
            error: null,
          });
        }
        return makeQueryChain(returnData);
      };
    }

    // When awaited
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: returnData, error: null });

    return chain;
  }

  const syncJobs = options.syncJobs ?? makeSyncJobs(["adapter-a", "adapter-b"]);

  return {
    _calls: calls,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user },
      }),
    },
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      if (table === "profiles") {
        return makeQueryChain({ is_admin: options.isAdmin });
      }
      // sync_jobs table
      return makeQueryChain(syncJobs);
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const mockClient = createMockSupabaseClient({ user: null, isAdmin: false });
    mockCreateClient.mockResolvedValue(
      mockClient as ReturnType<typeof createClient>
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns 403 for authenticated non-admin user", async () => {
    const mockClient = createMockSupabaseClient({
      user: { id: "user-123" },
      isAdmin: false,
    });
    mockCreateClient.mockResolvedValue(
      mockClient as ReturnType<typeof createClient>
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it("returns 200 with sync jobs for admin user", async () => {
    const mockClient = createMockSupabaseClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      mockClient as ReturnType<typeof createClient>
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns last 50 jobs by default (no source param)", async () => {
    // Track .limit() calls using a more detailed mock
    let capturedLimit: number | null = null;
    let capturedEqCalls: Array<[string, string]> = [];

    const queryChain: Record<string, unknown> = {};
    const makeSpy = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      chain.select = () => makeSpy();
      chain.order = () => makeSpy();
      chain.limit = (n: number) => {
        capturedLimit = n;
        return makeSpy();
      };
      chain.eq = (col: string, val: string) => {
        capturedEqCalls.push([col, val]);
        return makeSpy();
      };
      chain.single = () =>
        Promise.resolve({ data: { is_admin: true }, error: null });
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: makeSyncJobs(["a"]), error: null });
      return chain;
    };

    const mockClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
      from: (table: string) => {
        if (table === "profiles") return makeSpy();
        return makeSpy();
      },
    };

    mockCreateClient.mockResolvedValue(
      mockClient as ReturnType<typeof createClient>
    );

    await GET(makeRequest());

    expect(capturedLimit).toBe(50);
    expect(capturedEqCalls.filter(([col]) => col === "source")).toHaveLength(0);
  });

  it("adds .eq('source', ...) filter when source param is provided", async () => {
    let capturedEqCalls: Array<[string, string]> = [];

    const makeSpy = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      chain.select = () => makeSpy();
      chain.order = () => makeSpy();
      chain.limit = () => makeSpy();
      chain.eq = (col: string, val: string) => {
        capturedEqCalls.push([col, val]);
        return makeSpy();
      };
      chain.single = () =>
        Promise.resolve({ data: { is_admin: true }, error: null });
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: makeSyncJobs(["huggingface"]), error: null });
      return chain;
    };

    const mockClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
      from: () => makeSpy(),
    };

    mockCreateClient.mockResolvedValue(
      mockClient as ReturnType<typeof createClient>
    );

    const response = await GET(makeRequest({ source: "huggingface" }));
    expect(response.status).toBe(200);

    const sourceFilters = capturedEqCalls.filter(([col]) => col === "source");
    expect(sourceFilters).toHaveLength(1);
    expect(sourceFilters[0][1]).toBe("huggingface");
  });

  it("applies limit=10 when limit param is provided", async () => {
    let capturedLimit: number | null = null;

    const makeSpy = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      chain.select = () => makeSpy();
      chain.order = () => makeSpy();
      chain.limit = (n: number) => {
        capturedLimit = n;
        return makeSpy();
      };
      chain.eq = () => makeSpy();
      chain.single = () =>
        Promise.resolve({ data: { is_admin: true }, error: null });
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: makeSyncJobs(["a"]), error: null });
      return chain;
    };

    const mockClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
      from: () => makeSpy(),
    };

    mockCreateClient.mockResolvedValue(
      mockClient as ReturnType<typeof createClient>
    );

    await GET(makeRequest({ limit: "10" }));
    expect(capturedLimit).toBe(10);
  });

  it("clamps limit to 100 when limit > 100", async () => {
    let capturedLimit: number | null = null;

    const makeSpy = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      chain.select = () => makeSpy();
      chain.order = () => makeSpy();
      chain.limit = (n: number) => {
        capturedLimit = n;
        return makeSpy();
      };
      chain.eq = () => makeSpy();
      chain.single = () =>
        Promise.resolve({ data: { is_admin: true }, error: null });
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: makeSyncJobs(["a"]), error: null });
      return chain;
    };

    const mockClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
      from: () => makeSpy(),
    };

    mockCreateClient.mockResolvedValue(
      mockClient as ReturnType<typeof createClient>
    );

    await GET(makeRequest({ limit: "200" }));
    expect(capturedLimit).toBe(100);
  });
});
