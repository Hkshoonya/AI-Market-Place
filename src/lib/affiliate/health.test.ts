import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLookup, mockRequest } = vi.hoisted(() => ({ mockLookup: vi.fn(), mockRequest: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mockLookup }));
vi.mock("node:https", () => ({ request: mockRequest }));
import { checkAffiliateDestination } from "./health";

const replies: Array<{ status?: number; location?: string; error?: Error }> = [];
const closedResponses: ReturnType<typeof vi.fn>[] = [];
const connectedAddresses: unknown[] = [];

describe("affiliate destination health checks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    replies.length = closedResponses.length = connectedAddresses.length = 0;
    mockLookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
    // No real network access is allowed in these DNS/connection regression tests.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected unpinned fetch")));
    mockRequest.mockImplementation((url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
      const req = new EventEmitter();
      return Object.assign(req, {
        end: vi.fn(() => {
          const abort = () => req.emit("error", options.signal?.reason ?? new Error("aborted"));
          options.signal?.addEventListener("abort", abort, { once: true });
          if (options.signal?.aborted) { abort(); return; }
          options.lookup!(url.hostname, { all: true }, (error, addresses) => {
            if (options.signal?.aborted) return;
            if (error) { options.signal?.removeEventListener("abort", abort); req.emit("error", error); return; }
            connectedAddresses.push(addresses);
            const reply = replies.shift() ?? { status: 200 };
            if (reply.error) { options.signal?.removeEventListener("abort", abort); req.emit("error", reply.error); return; }
            const destroy = vi.fn(() => options.signal?.removeEventListener("abort", abort));
            closedResponses.push(destroy);
            callback({ statusCode: reply.status, headers: { location: reply.location }, destroy } as unknown as IncomingMessage);
          });
        }),
      });
    });
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("connects only through the validated DNS lookup, preserving hostname and TLS verification", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    const result = await checkAffiliateDestination("https://affiliate.example/start");
    expect(result).toMatchObject({ ok: true, httpStatus: 200 });
    expect(mockLookup).toHaveBeenCalledTimes(1);
    expect(connectedAddresses).toEqual([[{ address: "1.1.1.1", family: 4 }]]);
    expect(mockRequest).toHaveBeenCalledWith(new URL("https://affiliate.example/start"), expect.objectContaining({
      agent: false, rejectUnauthorized: true, lookup: expect.any(Function),
    }), expect.any(Function));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("checks each redirect's actual connection lookup and blocks a private resolution", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    replies.push({ status: 302, location: "https://redirect.example/next" });
    const result = await checkAffiliateDestination("https://affiliate.example/start");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/non-public address/i);
    expect(connectedAddresses).toHaveLength(1);
    expect(closedResponses[0]).toHaveBeenCalledOnce();
  });

  it("rejects mixed public/private DNS answers without opening a connection", async () => {
    mockLookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    expect((await checkAffiliateDestination("https://affiliate.example")).ok).toBe(false);
    expect(connectedAddresses).toHaveLength(0);
  });

  it.each([{ records: [] }, { records: [{ address: "0:0:0:0:0:0:0:1", family: 6 }] }])("rejects empty or reserved DNS answers: %j", async ({ records }) => {
    mockLookup.mockResolvedValue(records);
    expect((await checkAffiliateDestination("https://affiliate.example")).ok).toBe(false);
    expect(connectedAddresses).toHaveLength(0);
  });

  it("supports Node's single-address lookup callback", async () => {
    await checkAffiliateDestination("https://affiliate.example");
    const lookup = mockRequest.mock.calls[0][1].lookup;
    const callback = vi.fn();
    lookup("affiliate.example", { all: false }, callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(null, "1.1.1.1", 4));
  });

  it("does not expose raw DNS error details", async () => {
    mockLookup.mockRejectedValue(new Error("private resolver configuration"));
    expect(await checkAffiliateDestination("https://affiliate.example")).toMatchObject({ ok: false, error: "Destination DNS lookup failed" });
    expect(connectedAddresses).toHaveLength(0);
  });

  it("shares one deadline across HEAD, redirects and GET fallback, closing every response", async () => {
    replies.push({ status: 302, location: "/next" }, { status: 405 }, { status: 200 });
    const result = await checkAffiliateDestination("https://affiliate.example/start");
    expect(result.ok).toBe(true);
    expect(mockRequest.mock.calls.map((call) => call[1].method)).toEqual(["HEAD", "HEAD", "GET"]);
    expect(new Set(mockRequest.mock.calls.map((call) => call[1].signal)).size).toBe(1);
    expect(mockRequest.mock.calls[2][1].headers.Range).toBe("bytes=0-1023");
    expect(closedResponses).toHaveLength(3);
    for (const close of closedResponses) expect(close).toHaveBeenCalledOnce();
  });

  it("does not follow a redirect to a private literal", async () => {
    replies.push({ status: 302, location: "https://127.0.0.1/" });
    expect((await checkAffiliateDestination("https://affiliate.example")).ok).toBe(false);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it.each(["http://public.example/", "https://user:password@public.example/", "https://public.example:8443/"])("blocks an unsafe redirect: %s", async (location) => {
    replies.push({ status: 302, location });
    expect((await checkAffiliateDestination("https://affiliate.example")).ok).toBe(false);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(closedResponses[0]).toHaveBeenCalledOnce();
  });

  it("treats unsupported 3xx statuses as failures, not healthy destinations", async () => {
    replies.push({ status: 304 });
    expect(await checkAffiliateDestination("https://affiliate.example")).toMatchObject({ ok: false, httpStatus: 304 });
  });

  it("does not report a redirect without a Location header as healthy", async () => {
    replies.push({ status: 302 });
    const result = await checkAffiliateDestination("https://affiliate.example");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/redirect/i);
  });

  it("stops after five redirects and closes all responses", async () => {
    replies.push(...Array.from({ length: 6 }, () => ({ status: 302, location: "/again" })));
    const result = await checkAffiliateDestination("https://affiliate.example");
    expect(result.error).toMatch(/redirect limit/i);
    expect(mockRequest).toHaveBeenCalledTimes(6);
    for (const close of closedResponses) expect(close).toHaveBeenCalledOnce();
  });

  it("bounds DNS lookup itself with the overall deadline", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), ms);
      return controller.signal;
    });
    mockLookup.mockReturnValue(new Promise(() => {}));
    const check = checkAffiliateDestination("https://affiliate.example", { timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    await expect(check).resolves.toMatchObject({ ok: false, error: "Destination check timed out" });
  });

  it("avoids requests when cancelled and suppresses raw transport errors", async () => {
    const cancelled = await checkAffiliateDestination("https://affiliate.example", { signal: AbortSignal.abort() });
    expect(cancelled).toMatchObject({ ok: false, error: "Destination check cancelled" });
    expect(mockRequest).not.toHaveBeenCalled();
    replies.push({ error: new Error("private proxy credentials") });
    expect(await checkAffiliateDestination("https://affiliate.example")).toMatchObject({ ok: false, error: "Destination check failed" });
  });
});
