export const SERVICE_STATUS_URL = "https://aimarketcap-uptime-monitor.sense-fbf.workers.dev/";

export interface ServiceStatus {
  state: "operational" | "interrupted" | "unknown";
  checkedAt: number | null;
}

export function parseServiceStatus(value: unknown, now = Date.now()): ServiceStatus {
  const unknown: ServiceStatus = { state: "unknown", checkedAt: null };
  if (!value || typeof value !== "object") return unknown;
  const raw = value as Record<string, unknown>;
  if (typeof raw.checkedAt !== "number" || !Number.isFinite(raw.checkedAt)
    || raw.checkedAt < now - 180_000 || raw.checkedAt > now + 60_000) return unknown;
  if (raw.health === "up") return { state: "operational", checkedAt: raw.checkedAt };
  if ((raw.health === "down" || raw.health === "degraded")
    && typeof raw.consecutiveFailures === "number" && raw.consecutiveFailures >= 2) {
    return { state: "interrupted", checkedAt: raw.checkedAt };
  }
  return unknown;
}

export async function fetchServiceStatus(): Promise<ServiceStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(SERVICE_STATUS_URL, {
      signal: controller.signal, credentials: "omit", cache: "no-store", redirect: "error",
    });
    if (!response.ok) { await response.body?.cancel(); return { state: "unknown", checkedAt: null }; }
    return parseServiceStatus(await response.json());
  } catch {
    return { state: "unknown", checkedAt: null };
  } finally {
    clearTimeout(timer);
  }
}
