import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: vi.fn(),
  profile: vi.fn(),
  rate: vi.fn(),
  launch: vi.fn(),
  quote: vi.fn(),
  operate: vi.fn(),
  reveal: vi.fn(),
  connections: vi.fn(),
  secret: vi.fn(),
  gpus: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: m.user } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: m.from }),
}));
vi.mock("@/lib/provider-connections/server", () => ({
  listProviderConnections: m.connections,
  getProviderConnectionSecret: m.secret,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: m.rate,
  rateLimitHeaders: () => ({}),
}));
vi.mock("@/lib/runpod/service", () => ({
  publicPod: (row: { id: string; status: string }) => ({
    id: row.id,
    status: row.status,
  }),
  quoteRunpodPod: m.quote,
  launchRunpodPod: m.launch,
  operateRunpodPod: m.operate,
  revealRunpodApiKey: m.reveal,
  runpodLaunchEnabled: () => true,
}));
vi.mock("@/lib/runpod/client", async () => ({
  ...(await vi.importActual("@/lib/runpod/client")),
  getRunpodGpus: m.gpus,
}));
import { GET, POST } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown, origin = "https://aimarketcap.tech") =>
  new Request("https://aimarketcap.tech/api/workspace/pods", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  m.profile.mockResolvedValue({ data: { is_banned: false }, error: null });
  m.rate.mockResolvedValue({ success: true });
  m.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: m.profile }) }),
  }));
  m.connections.mockResolvedValue([]);
  m.launch.mockResolvedValue({ id, status: "starting" });
});
describe("Pod route security", () => {
  it("requires a real session on both read and mutation routes", async () => {
    m.user.mockResolvedValue({ data: { user: null } });
    expect(
      (await GET(new Request("https://aimarketcap.tech/api/workspace/pods")))
        .status,
    ).toBe(401);
    expect(
      (
        await POST(
          request({ action: "launch", id, acceptProviderCharges: true }),
        )
      ).status,
    ).toBe(401);
    expect(m.launch).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations before touching credentials", async () => {
    expect(
      (
        await POST(
          request(
            { action: "launch", id, acceptProviderCharges: true },
            "https://evil.example",
          ),
        )
      ).status,
    ).toBe(403);
    expect(m.user).not.toHaveBeenCalled();
    expect(m.launch).not.toHaveBeenCalled();
  });
  it.each([
    { data: { is_banned: true }, error: null },
    { data: null, error: new Error("db down") },
  ])("fails closed on banned/missing accounts", async (profile) => {
    m.profile.mockResolvedValue(profile);
    expect((await POST(request({ action: "refresh", id }))).status).toBe(403);
    expect(m.operate).not.toHaveBeenCalled();
  });
  it.each([
    { action: "launch", id },
    { action: "launch", id, acceptProviderCharges: false },
    { action: "terminate", id },
    { action: "stop", id },
    { action: "resume", id },
    { action: "reveal_key", id: "../../secret" },
    { action: "launch", id, acceptProviderCharges: true, userId: "victim" },
    {
      action: "quote",
      connectionId: id,
      modelKey: "qwen3-8b",
      gpuTypeId: "A40",
      volumeGb: 999999,
    },
  ])(
    "rejects missing consent, injected fields and malformed IDs: %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(m.launch).not.toHaveBeenCalled();
      expect(m.operate).not.toHaveBeenCalled();
    },
  );
  it("never trusts a client owner ID and does not cache launch responses", async () => {
    const result = await POST(
      request({ action: "launch", id, acceptProviderCharges: true }),
    );
    expect(result.status).toBe(202);
    expect(m.launch).toHaveBeenCalledWith("owner", id);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
  it("never caches a revealed Pod key", async () => {
    m.reveal.mockResolvedValue({ apiKey: "dedicated-key" });
    const result = await POST(request({ action: "reveal_key", id }));
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(m.reveal).toHaveBeenCalledWith("owner", id);
  });
  it("rate-limits per account and action before calling Runpod", async () => {
    m.rate.mockResolvedValue({ success: false });
    expect(
      (
        await POST(
          request({ action: "launch", id, acceptProviderCharges: true }),
        )
      ).status,
    ).toBe(429);
    expect(m.launch).not.toHaveBeenCalled();
    expect(m.rate).toHaveBeenCalledWith(
      "runpod-launch:owner",
      expect.anything(),
    );
  });
  it("does not use a connection ID that is not owned by this session", async () => {
    const result = await GET(
      new Request(
        `https://aimarketcap.tech/api/workspace/pods?connectionId=${id}`,
      ),
    );
    expect(result.status).toBe(404);
    expect(m.secret).not.toHaveBeenCalled();
  });
  it("does not expose arbitrary upstream errors", async () => {
    m.launch.mockRejectedValue(new Error("provider-key-secret"));
    const result = await POST(
      request({ action: "launch", id, acceptProviderCharges: true }),
    );
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain("provider-key-secret");
  });
  it("always includes active Pods before bounded terminal history without exposing encrypted keys", async () => {
    const owned = vi.fn();
    m.from.mockImplementation((table: string) => {
      if (table === "profiles")
        return { select: () => ({ eq: () => ({ single: m.profile }) }) };
      let active = false;
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          owned(key, value);
          return query;
        },
        not: () => {
          active = true;
          return query;
        },
        in: () => query,
        order: () => query,
        limit: async (limit: number) => ({
          data: active
            ? [
                {
                  id: "old-running-pod",
                  status: "running",
                  encrypted_api_key: "secret",
                },
              ]
            : Array.from({ length: limit }, (_, i) => ({
                id: `history-${i}`,
                status: "terminated",
              })),
          error: null,
        }),
      };
      return query;
    });
    const result = await GET(
      new Request("https://aimarketcap.tech/api/workspace/pods"),
    );
    const body = await result.json();
    expect(body.pods).toHaveLength(21);
    expect(body.pods[0].id).toBe("old-running-pod");
    expect(owned).toHaveBeenCalledWith("user_id", "owner");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
});
