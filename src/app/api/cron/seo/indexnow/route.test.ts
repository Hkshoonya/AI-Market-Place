import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSubmitIndexNowUrls = vi.fn();
const mockSitemap = vi.fn();
const mockTrackerComplete = vi.fn();
const mockTrackerFail = vi.fn();
const mockTrackerSkip = vi.fn();
const mockTrackCronRun = vi.fn().mockResolvedValue({
  complete: (...args: unknown[]) => mockTrackerComplete(...args),
  fail: (...args: unknown[]) => mockTrackerFail(...args),
  skip: (...args: unknown[]) => mockTrackerSkip(...args),
  runId: "cron-run-1",
  shouldSkip: false,
});

vi.mock("@/app/sitemap", () => ({
  default: () => mockSitemap(),
}));

vi.mock("@/lib/seo/indexnow", () => ({
  isIndexNowConfigured: () => true,
  normalizeIndexNowUrls: (urls: string[]) => urls,
  submitIndexNowUrls: (...args: unknown[]) => mockSubmitIndexNowUrls(...args),
}));

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

describe("GET /api/cron/seo/indexnow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    mockTrackerComplete.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, ...data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    mockTrackerFail.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    mockTrackerSkip.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("returns 401 without the cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("https://aimarketcap.tech/api/cron/seo/indexnow"));
    expect(response.status).toBe(401);
  });

  it("submits sitemap urls on GET", async () => {
    mockSitemap.mockResolvedValue([
      { url: "https://aimarketcap.tech/" },
      { url: "https://aimarketcap.tech/models/model-a" },
    ]);
    mockSubmitIndexNowUrls.mockResolvedValue({
      endpoint: "https://api.indexnow.org/indexnow",
      host: "aimarketcap.tech",
      keyLocation: "https://aimarketcap.tech/indexnow-key",
      batchCount: 1,
      submittedUrlCount: 2,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/cron/seo/indexnow", {
        headers: { authorization: "Bearer test-cron-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(mockSubmitIndexNowUrls).toHaveBeenCalledWith([
      "https://aimarketcap.tech/",
      "https://aimarketcap.tech/models/model-a",
    ]);
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "sitemap",
        submittedUrlCount: 2,
      })
    );
  });

  it("submits explicit urls on POST", async () => {
    mockSubmitIndexNowUrls.mockResolvedValue({
      endpoint: "https://api.indexnow.org/indexnow",
      host: "aimarketcap.tech",
      keyLocation: "https://aimarketcap.tech/indexnow-key",
      batchCount: 1,
      submittedUrlCount: 1,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/cron/seo/indexnow", {
        method: "POST",
        headers: {
          authorization: "Bearer test-cron-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          urls: ["https://aimarketcap.tech/providers/openai"],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockSubmitIndexNowUrls).toHaveBeenCalledWith([
      "https://aimarketcap.tech/providers/openai",
    ]);
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "selected",
        submittedUrlCount: 1,
      })
    );
  });
});
