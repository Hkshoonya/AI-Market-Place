/**
 * SWR revalidation tier constants.
 *
 * FAST  — ticker, top movers, auction data (30s refresh)
 * MEDIUM — notifications, wallet, order status (60s refresh)
 * SLOW  — model metadata, descriptions, deployments (no polling)
 */
export const SWR_TIERS = {
  FAST: { refreshInterval: 30_000, dedupingInterval: 10_000 },
  MEDIUM: { refreshInterval: 60_000, dedupingInterval: 30_000 },
  SLOW: { refreshInterval: 0, dedupingInterval: 300_000 },
} as const;
