import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateAdminClient = vi.fn();
const mockSettleEnglishAuction = vi.fn();
const mockRefundEscrow = vi.fn();
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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/marketplace/auctions/english", () => ({
  settleEnglishAuction: (...args: unknown[]) => mockSettleEnglishAuction(...args),
}));

vi.mock("@/lib/payments/wallet", () => ({
  refundEscrow: (...args: unknown[]) => mockRefundEscrow(...args),
}));

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

function createAdminClient({
  tableCheckError = null,
  upcomingAuctions = [],
  expiredAuctions = [],
}: {
  tableCheckError?: { message?: string; code?: string } | null;
  upcomingAuctions?: Array<Record<string, unknown>>;
  expiredAuctions?: Array<Record<string, unknown>>;
}) {
  let auctionsQueryCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table !== "auctions") {
        throw new Error(`Unexpected table: ${table}`);
      }

      auctionsQueryCount += 1;

      if (auctionsQueryCount === 1) {
        return {
          select: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: tableCheckError,
            }),
          })),
        };
      }

      if (auctionsQueryCount === 2) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              lte: vi.fn().mockResolvedValue({
                data: upcomingAuctions,
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                error: null,
                count: upcomingAuctions.length,
              }),
            })),
          })),
        };
      }

      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: expiredAuctions,
          error: null,
        }),
        update: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              error: null,
              count: upcomingAuctions.length,
            }),
          })),
        })),
      };

      return builder;
    }),
  };
}

function makeRequest() {
  return new NextRequest("https://aimarketcap.tech/api/cron/auctions", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("auction cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockCreateAdminClient.mockReturnValue(createAdminClient({}));
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

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 202 when there are no auctions to activate or settle", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(mockSettleEnglishAuction).not.toHaveBeenCalled();
    expect(mockTrackerComplete).toHaveBeenCalledWith({
      message: "No auctions required activation or settlement",
      activated: 0,
      settled: 0,
      cancelled: 0,
    });
  });
});
