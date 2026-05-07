import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const selectMock = vi.fn(() => ({ single: vi.fn() }));
const fromMock = vi.fn(() => ({
  insert: insertMock,
}));
const hasAdminClientConfigMock = vi.fn(() => true);
const createAdminClientMock = vi.fn(() => ({
  from: fromMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
  hasAdminClientConfig: hasAdminClientConfigMock,
}));

describe("logging", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    insertMock.mockReturnValue({ select: selectMock });
    hasAdminClientConfigMock.mockReturnValue(true);
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("skips durable log writes during e2e mode", async () => {
    vi.stubEnv("E2E_TEST_MODE", "true");
    const { systemLog } = await import("./logging");

    const result = await systemLog.info("test", "hello");

    expect(result).toBeNull();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("skips durable log writes when admin Supabase config is missing", async () => {
    hasAdminClientConfigMock.mockReturnValue(false);
    const { systemLog } = await import("./logging");

    const result = await systemLog.info("test", "hello");

    expect(result).toBeNull();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});
