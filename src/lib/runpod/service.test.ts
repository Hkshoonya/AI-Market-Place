import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunpodPodRecord } from "@/types/database";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  connection: vi.fn(),
  account: vi.fn(),
  gpus: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  control: vi.fn(),
  ready: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/provider-connections/server", () => ({
  getProviderConnectionSecret: mocks.connection,
}));
vi.mock("@/lib/provider-connections/crypto", () => ({
  encryptProviderSecret: () => "encrypted",
  decryptProviderSecret: () => "dedicated-pod-api-key",
}));
vi.mock("./client", async () => ({
  ...(await vi.importActual("./client")),
  getRunpodAccount: mocks.account,
  getRunpodGpus: mocks.gpus,
  createRunpodPod: mocks.create,
  findRunpodPod: mocks.find,
  controlRunpodPod: mocks.control,
  isRunpodApiReady: mocks.ready,
}));
import {
  launchRunpodPod,
  loadOwnedPod,
  operateRunpodPod,
  publicPod,
  revealRunpodApiKey,
  RUNPOD_IMAGE,
} from "./service";

const id = "11111111-1111-4111-8111-111111111111";
function fixture(patch: Partial<RunpodPodRecord> = {}): RunpodPodRecord {
  return {
    id,
    user_id: "user1",
    provider_connection_id: "connection1",
    external_account_id: "account1",
    model_key: "qwen3-8b",
    gpu_type_id: "NVIDIA A40",
    gpu_name: "A40",
    gpu_memory_gb: 48,
    volume_gb: 30,
    gpu_price_per_hr: 0.4,
    observed_price_per_hr: null,
    image_name: RUNPOD_IMAGE,
    encrypted_api_key: "encrypted",
    status: "quoted",
    external_pod_id: null,
    quote_expires_at: new Date(Date.now() + 300_000).toISOString(),
    consented_at: null,
    last_checked_at: null,
    api_ready: false,
    last_error: null,
    operation_id: null,
    operation_expires_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...patch,
  };
}

// In-memory query double asserts actual ownership/CAS predicates, not just call order.
function database(initial: RunpodPodRecord) {
  let row = { ...initial };
  const filters: Array<[string, unknown]> = [];
  const rpc = vi.fn(
    async (_: string, args: { p_id: string; p_user_id: string }) => {
      const claimed =
        row.status === "quoted" &&
        row.id === args.p_id &&
        row.user_id === args.p_user_id;
      if (claimed) row = { ...row, status: "creating" };
      return { data: claimed, error: null };
    },
  );
  const from = vi.fn(() => {
    const equals: Array<[string, unknown]> = [];
    let patch: Partial<RunpodPodRecord> | null = null;
    let lock = false;
    const result = () => {
      const matches =
        equals.every(
          ([key, value]) => row[key as keyof RunpodPodRecord] === value,
        ) &&
        (!lock ||
          !row.operation_expires_at ||
          Date.parse(row.operation_expires_at) < Date.now());
      if (!matches) return { data: null, error: null };
      if (patch) row = { ...row, ...patch };
      return { data: { ...row }, error: null };
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        equals.push([key, value]);
        filters.push([key, value]);
        return query;
      },
      or: () => {
        lock = true;
        return query;
      },
      update: (value: Partial<RunpodPodRecord>) => {
        patch = value;
        return query;
      },
      maybeSingle: async () => result(),
      single: async () => result(),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
        Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  mocks.admin.mockReturnValue({ from, rpc });
  return { rpc, filters, read: () => row };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RUNPOD_PODS_ENABLED", "true");
  mocks.connection.mockResolvedValue({
    secret: "user-runpod-key",
    provider: "runpod",
    id: "connection1",
  });
  mocks.account.mockResolvedValue("account1");
  mocks.gpus.mockResolvedValue([
    { id: "NVIDIA A40", memoryGb: 48, pricePerHour: 0.4 },
  ]);
  mocks.create.mockResolvedValue({
    id: "pod12345",
    name: `aimc-${id}`,
    consumerUserId: "account1",
    desiredStatus: "RUNNING",
    costPerHr: 0.42,
  });
  mocks.find.mockImplementation(() => mocks.create());
  mocks.control.mockResolvedValue(undefined);
  mocks.ready.mockResolvedValue(false);
});
afterEach(() => vi.unstubAllEnvs());

describe("Runpod lifecycle safety", () => {
  it("fails closed for another user's deployment before reading credentials", async () => {
    const db = database(fixture());
    await expect(launchRunpodPod("attacker", id)).rejects.toThrow("not found");
    expect(db.filters).toContainEqual(["user_id", "attacker"]);
    expect(mocks.connection).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires the rollout gate before resource creation", async () => {
    database(fixture());
    vi.stubEnv("RUNPOD_PODS_ENABLED", "false");
    await expect(launchRunpodPod("user1", id)).rejects.toThrow(
      "awaiting live deployment verification",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects expired quotes without contacting Runpod", async () => {
    database(fixture({ quote_expires_at: "2020-01-01T00:00:00Z" }));
    await expect(launchRunpodPod("user1", id)).rejects.toThrow("expired");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rechecks live pricing before claiming or creating a Pod", async () => {
    const db = database(fixture());
    mocks.gpus.mockResolvedValue([{ id: "NVIDIA A40", pricePerHour: 0.5 }]);
    await expect(launchRunpodPod("user1", id)).rejects.toThrow(
      "pricing changed",
    );
    expect(db.rpc).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects account replacement before launch", async () => {
    database(fixture());
    mocks.account.mockResolvedValue("other-account");
    await expect(launchRunpodPod("user1", id)).rejects.toThrow(
      "account has changed",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("atomically consumes a quote once and never marks allocation as API ready", async () => {
    const db = database(fixture());
    const first = await launchRunpodPod("user1", id);
    const second = await launchRunpodPod("user1", id);
    expect(first.status).toBe("starting");
    expect(first.apiReady).toBe(false);
    expect(second.id).toBe(first.id);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("claim_runpod_quote", {
      p_id: id,
      p_user_id: "user1",
    });
    expect(mocks.connection).toHaveBeenCalledWith({
      userId: "user1",
      connectionId: "connection1",
      expectedProvider: "runpod",
    });
  });
  it("does not create if another request won the database claim", async () => {
    const db = database(fixture());
    db.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(launchRunpodPod("user1", id)).rejects.toThrow(
      "already consumed",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("preserves an uncertain launch and does not retry it", async () => {
    const db = database(fixture());
    mocks.create.mockRejectedValue(new Error("provider returned SECRET"));
    const first = await launchRunpodPod("user1", id);
    await launchRunpodPod("user1", id);
    expect(first.status).toBe("unknown");
    expect(first.lastError).not.toContain("SECRET");
    expect(db.read().status).toBe("unknown");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("recovers a lost create response by exact unique name without creating again", async () => {
    database(fixture({ status: "unknown" }));
    mocks.find.mockResolvedValue({
      id: "pod12345",
      name: `aimc-${id}`,
      consumerUserId: "account1",
      desiredStatus: "RUNNING",
    });
    const result = await operateRunpodPod("user1", id, "refresh");
    expect(result.status).toBe("running");
    expect(result.apiReady).toBe(false);
    expect(mocks.find).toHaveBeenCalledWith("user-runpod-key", {
      id: undefined,
      name: `aimc-${id}`,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("never interprets an absent uncertain Pod as proof that a new launch is safe", async () => {
    const db = database(fixture({ status: "unknown" }));
    mocks.find.mockResolvedValue(null);
    expect((await operateRunpodPod("user1", id, "refresh")).status).toBe(
      "unknown",
    );
    expect(db.read().operation_id).toBeNull();
  });
  it("blocks a concurrent lifecycle operation", async () => {
    database(
      fixture({
        status: "running",
        external_pod_id: "pod12345",
        operation_expires_at: new Date(Date.now() + 50_000).toISOString(),
      }),
    );
    await expect(operateRunpodPod("user1", id, "terminate")).rejects.toThrow(
      "in progress",
    );
    expect(mocks.control).not.toHaveBeenCalled();
  });
  it("requires both remote account and resource-name ownership before destructive controls", async () => {
    const db = database(
      fixture({ status: "running", external_pod_id: "pod12345" }),
    );
    mocks.find.mockResolvedValue({
      id: "pod12345",
      name: "someone-elses-pod",
      consumerUserId: "account1",
      desiredStatus: "RUNNING",
    });
    await expect(operateRunpodPod("user1", id, "terminate")).rejects.toThrow(
      "identity",
    );
    expect(mocks.control).not.toHaveBeenCalled();
    expect(db.read().operation_id).toBeNull();
  });
  it("keeps emergency stop available when launch is disabled", async () => {
    database(fixture({ status: "running", external_pod_id: "pod12345" }));
    vi.stubEnv("RUNPOD_PODS_ENABLED", "false");
    expect((await operateRunpodPod("user1", id, "stop")).status).toBe(
      "stopping",
    );
    expect(mocks.control).toHaveBeenCalledWith(
      "user-runpod-key",
      "pod12345",
      "stop",
    );
  });
  it("does not claim deletion succeeded on a provider timeout", async () => {
    const db = database(
      fixture({ status: "running", external_pod_id: "pod12345" }),
    );
    mocks.control.mockRejectedValue(new Error("timeout"));
    await expect(operateRunpodPod("user1", id, "terminate")).rejects.toThrow();
    expect(db.read().status).toBe("terminating");
    expect(db.read().last_error).toContain("billing");
  });
  it("rechecks resume pricing and only resumes stopped Pods", async () => {
    database(fixture({ status: "stopped", external_pod_id: "pod12345" }));
    mocks.find.mockResolvedValue({
      id: "pod12345",
      name: `aimc-${id}`,
      consumerUserId: "account1",
      desiredStatus: "EXITED",
    });
    await expect(operateRunpodPod("user1", id, "resume", 0.3)).rejects.toThrow(
      "price or availability changed",
    );
    expect(mocks.control).not.toHaveBeenCalled();
  });
  it("never serializes connection secrets or API keys in list/quote responses", () => {
    const result = JSON.stringify(publicPod(fixture()));
    expect(result).not.toContain("encrypted");
    expect(result).not.toContain("account1");
    expect(result).not.toContain("connection1");
  });
  it("reveals only the owning user's dedicated API credential", async () => {
    database(fixture({ status: "running", external_pod_id: "pod12345" }));
    await expect(revealRunpodApiKey("attacker", id)).rejects.toThrow(
      "not found",
    );
    expect(await revealRunpodApiKey("user1", id)).toEqual({
      apiKey: "dedicated-pod-api-key",
      endpointUrl: "https://pod12345-8000.proxy.runpod.net/v1",
      model: "qwen3-8b",
    });
  });
  it("load errors cannot return another user's data", async () => {
    database(fixture());
    await expect(loadOwnedPod("unknown", id)).rejects.toThrow("not found");
  });
});
