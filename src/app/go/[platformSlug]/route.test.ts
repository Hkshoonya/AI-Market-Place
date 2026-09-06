import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAdmin, mockWarn } = vi.hoisted(() => ({
  mockAdmin: vi.fn(),
  mockWarn: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }));
vi.mock("@/lib/api-error", () => ({
  handleApiError: () => new Response("Unavailable", { status: 500 }),
}));

import * as route from "./route";

const modelId = "00000000-0000-4000-8000-000000000001";
const defaultLink = {
  id: "default-link", platform_id: "platform", model_id: null,
  destination_url: "https://runpod.io/?ref=owner", priority: 100, status: "active",
};

type Row = Record<string, unknown>;

function database(links: Row[]) {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    let rows: Row[] = table === "deployment_platforms"
      ? [{ id: "platform", slug: "runpod", base_url: "https://runpod.io/" }]
      : table === "models"
        ? [{ id: modelId, slug: "test-model" }]
        : table === "affiliate_links" ? [...links] : [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => {
        rows = rows.filter((row) => row[key] === value);
        return query;
      }),
      is: vi.fn((key: string, value: unknown) => {
        rows = rows.filter((row) => row[key] === value);
        return query;
      }),
      not: vi.fn(() => query),
      or: vi.fn((filter: string) => {
        if (filter.includes("model_id.eq.")) {
          rows = rows.filter((row) => row.model_id === modelId || row.model_id === null);
        }
        return query;
      }),
      order: vi.fn(() => {
        rows.sort((a, b) => Number(a.priority) - Number(b.priority));
        return query;
      }),
      limit: vi.fn((limit: number) => { rows = rows.slice(0, limit); return query; }),
      single: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  });
  mockAdmin.mockReturnValue({ from, rpc });
  return { rpc };
}

function request(headers: Record<string, string> = {}, method = "GET", model = false) {
  return new Request(`https://aimarketcap.tech/go/runpod?source=model-card${model ? "&model=test-model" : ""}`, {
    method, headers: { "user-agent": "Mozilla/5.0", ...headers },
  });
}

const context = () => ({ params: Promise.resolve({ platformSlug: "runpod" }) });

describe("provider referral redirects", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(mockWarn);
  });

  it("finds the default referral even after more than 20 unrelated model links", async () => {
    const unrelated = Array.from({ length: 25 }, (_, i) => ({
      ...defaultLink, id: `other-${i}`, model_id: `other-${i}`, priority: i,
    }));
    const { rpc } = database([...unrelated, defaultLink]);
    const response = await route.GET(request(), context());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(defaultLink.destination_url);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("record_affiliate_click", {
      p_affiliate_link_id: defaultLink.id, p_source: "model-card",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("prefers the requested model's referral over higher-priority unrelated/default links", async () => {
    database([
      ...Array.from({ length: 25 }, (_, i) => ({ ...defaultLink, model_id: `other-${i}`, priority: i })),
      defaultLink,
      { ...defaultLink, id: "model-link", model_id: modelId, priority: 200, destination_url: "https://runpod.io/?ref=model-owner" },
    ]);
    const response = await route.GET(request({}, "GET", true), context());
    expect(response.headers.get("location")).toBe("https://runpod.io/?ref=model-owner");
  });

  it.each([
    { "next-router-prefetch": "1" },
    { purpose: "prefetch" },
    { "sec-purpose": "prefetch;prerender" },
    { "user-agent": "Googlebot/2.1" },
    { "user-agent": "AI-Market-Cap-Affiliate-Maintainer/1.0" },
  ])("does not count automated requests as clicks: %j", async (headers) => {
    const { rpc } = database([defaultLink]);
    const response = await route.GET(request(headers as Record<string, string>), context());
    expect(response.status).toBe(307);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("supports a HEAD redirect without recording a click", async () => {
    const { rpc } = database([defaultLink]);
    const head = (route as typeof route & { HEAD?: typeof route.GET }).HEAD;
    expect(head).toBeTypeOf("function");
    if (!head) return;
    const response = await head(request({}, "HEAD"), context());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(defaultLink.destination_url);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still redirects when click accounting throws, without logging private error text", async () => {
    const { rpc } = database([defaultLink]);
    rpc.mockRejectedValue(new Error("private connection credentials"));
    const response = await route.GET(request(), context());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(defaultLink.destination_url);
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain("private connection credentials");
  });

  it("still redirects when click accounting returns an error", async () => {
    const { rpc } = database([defaultLink]);
    rpc.mockResolvedValue({ error: { message: "private connection credentials" } });
    expect((await route.GET(request(), context())).status).toBe(307);
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain("private connection credentials");
  });

  it("falls back to the provider website without claiming a referral click", async () => {
    const { rpc } = database([]);
    const response = await route.GET(request(), context());
    expect(response.headers.get("location")).toBe("https://runpod.io/");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never redirects to a stored private destination", async () => {
    const { rpc } = database([{ ...defaultLink, destination_url: "https://127.0.0.1/" }]);
    const response = await route.GET(request(), context());
    expect(response.status).toBe(500);
    expect(response.headers.get("location")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
