import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getStripePaymentsHealth,
  getStripeWebhookDeliveryHealth,
} from "./stripe-health";

const ORIGINAL_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const ORIGINAL_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const NOW = new Date("2026-04-12T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  if (ORIGINAL_STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE_SECRET_KEY;

  if (ORIGINAL_STRIPE_WEBHOOK_SECRET === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_STRIPE_WEBHOOK_SECRET;

  if (ORIGINAL_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
      ORIGINAL_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }

  vi.useRealTimers();
});

type MockRow = Record<string, unknown>;

function createSupabaseMock(
  tables: Record<string, { data: MockRow[] | null; error: { message: string; code?: string } | null }>
) {
  return {
    from: (table: string) => {
      const result = tables[table] ?? { data: [], error: null };
      let currentData = Array.isArray(result.data) ? [...result.data] : result.data;

      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          if (Array.isArray(currentData)) {
            currentData = currentData.filter((row) => row[column] === value);
          }
          return chain;
        },
        gte: (column: string, value: unknown) => {
          if (Array.isArray(currentData)) {
            currentData = currentData.filter((row) => {
              const current = row[column];
              return typeof current === "string" && typeof value === "string"
                ? current >= value
                : true;
            });
          }
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        insert: () => Promise.resolve({ error: result.error }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: currentData, error: result.error }),
      };

      return chain;
    },
  };
}

describe("getStripeWebhookDeliveryHealth", () => {
  it("returns degraded when recent Stripe deliveries are failing consecutively", async () => {
    const supabase = createSupabaseMock({
      payment_webhook_events: {
        data: [
          {
            provider: "stripe",
            delivery_status: "failed",
            created_at: "2026-04-12T10:00:00.000Z",
          },
          {
            provider: "stripe",
            delivery_status: "failed",
            created_at: "2026-04-12T09:00:00.000Z",
          },
          {
            provider: "stripe",
            delivery_status: "failed",
            created_at: "2026-04-12T08:00:00.000Z",
          },
        ],
        error: null,
      },
    });

    const health = await getStripeWebhookDeliveryHealth(supabase as never, {
      status: "ready",
      checkoutConfigured: true,
      webhookConfigured: true,
      publishableKeyConfigured: true,
      blockingIssues: [],
    });

    expect(health.status).toBe("degraded");
    expect(health.consecutiveFailures).toBe(3);
    expect(health.recentFailures24h).toBe(3);
    expect(health.recentSuccesses24h).toBe(0);
  });

  it("returns healthy when a processed delivery is newer than the last failure", async () => {
    const supabase = createSupabaseMock({
      payment_webhook_events: {
        data: [
          {
            provider: "stripe",
            delivery_status: "processed",
            created_at: "2026-04-12T10:00:00.000Z",
          },
          {
            provider: "stripe",
            delivery_status: "failed",
            created_at: "2026-04-12T09:00:00.000Z",
          },
        ],
        error: null,
      },
    });

    const health = await getStripeWebhookDeliveryHealth(supabase as never, {
      status: "ready",
      checkoutConfigured: true,
      webhookConfigured: true,
      publishableKeyConfigured: true,
      blockingIssues: [],
    });

    expect(health.status).toBe("healthy");
    expect(health.latestProcessedAt).toBe("2026-04-12T10:00:00.000Z");
    expect(health.latestFailedAt).toBe("2026-04-12T09:00:00.000Z");
  });

  it("returns unknown when the webhook telemetry table is unavailable", async () => {
    const supabase = createSupabaseMock({
      payment_webhook_events: {
        data: null,
        error: { code: "42P01", message: "relation payment_webhook_events does not exist" },
      },
    });

    const health = await getStripeWebhookDeliveryHealth(supabase as never, {
      status: "ready",
      checkoutConfigured: true,
      webhookConfigured: true,
      publishableKeyConfigured: true,
      blockingIssues: [],
    });

    expect(health.status).toBe("unknown");
    expect(health.tableAvailable).toBe(false);
    expect(health.warning).toContain("payment_webhook_events");
  });
});

describe("getStripePaymentsHealth", () => {
  it("preserves readiness failures while reporting unknown webhook delivery health", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_configured";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_configured";

    const supabase = createSupabaseMock({});
    const health = await getStripePaymentsHealth(supabase as never);

    expect(health.status).toBe("partial");
    expect(health.blockingIssues).toContain(
      "STRIPE_WEBHOOK_SECRET is missing, so completed payments will not credit wallets."
    );
    expect(health.webhookDelivery.status).toBe("unknown");
  });
});
