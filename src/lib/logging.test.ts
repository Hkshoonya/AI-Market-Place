import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();
const mockHasAdminClientConfig = vi.fn(() => true);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
  hasAdminClientConfig: () => mockHasAdminClientConfig(),
}));

vi.mock("@/lib/runtime-environment", () => ({
  isE2ETestMode: () => false,
}));

function createAdminStub() {
  const single = vi.fn().mockResolvedValue({ data: { id: "log-1" }, error: null });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return {
    insert,
    client: { from: vi.fn(() => ({ insert })) },
  };
}

describe("systemLog persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PERSIST_INFO_LOGS;
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PERSIST_INFO_LOGS;
  });

  it("keeps routine info logs in the platform console by default", async () => {
    const { systemLog } = await import("./logging");

    await systemLog.info("test", "routine event");

    expect(console.info).toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("persists warnings for operational diagnostics", async () => {
    const admin = createAdminStub();
    mockCreateAdminClient.mockReturnValue(admin.client);
    const { systemLog } = await import("./logging");

    await systemLog.warn("test", "attention required");

    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", source: "test" })
    );
  });

  it("allows explicit info persistence when diagnostics require it", async () => {
    process.env.PERSIST_INFO_LOGS = "true";
    const admin = createAdminStub();
    mockCreateAdminClient.mockReturnValue(admin.client);
    const { systemLog } = await import("./logging");

    await systemLog.info("test", "persisted event");

    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info", source: "test" })
    );
  });
});
