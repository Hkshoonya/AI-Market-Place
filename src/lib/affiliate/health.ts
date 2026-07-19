import "server-only";

import { lookup } from "node:dns/promises";
import {
  isPublicAffiliateAddress,
  parseSafeAffiliateDestination,
} from "./url";

export interface AffiliateHealthResult {
  ok: boolean;
  status: "healthy" | "redirected" | "failed";
  httpStatus: number | null;
  finalUrl: string;
  redirectCount: number;
  error: string | null;
}

async function assertPublicResolution(url: URL) {
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    records.length === 0 ||
    records.some((record) => !isPublicAffiliateAddress(record.address))
  ) {
    throw new Error("Affiliate destination resolved to a non-public address");
  }
}

async function requestWithSafeRedirects(input: {
  destination: string;
  method: "HEAD" | "GET";
  timeoutMs: number;
  signal?: AbortSignal;
}) {
  let current = parseSafeAffiliateDestination(input.destination);
  let redirectCount = 0;

  while (redirectCount <= 5) {
    await assertPublicResolution(current);
    const timeoutSignal = AbortSignal.timeout(input.timeoutMs);
    const signal = input.signal
      ? AbortSignal.any([input.signal, timeoutSignal])
      : timeoutSignal;
    const response = await fetch(current, {
      method: input.method,
      redirect: "manual",
      headers: {
        "User-Agent": "AI-Market-Cap-Affiliate-Maintainer/1.0",
        ...(input.method === "GET" ? { Range: "bytes=0-1023" } : {}),
      },
      cache: "no-store",
      signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, current, redirectCount };
      current = parseSafeAffiliateDestination(new URL(location, current).toString());
      redirectCount += 1;
      continue;
    }

    return { response, current, redirectCount };
  }

  throw new Error("Destination exceeded the safe redirect limit");
}

export async function checkAffiliateDestination(
  destination: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<AffiliateHealthResult> {
  const timeoutMs = options?.timeoutMs ?? 8_000;

  try {
    let result = await requestWithSafeRedirects({
      destination,
      method: "HEAD",
      timeoutMs,
      signal: options?.signal,
    });

    if ([400, 403, 405].includes(result.response.status)) {
      result = await requestWithSafeRedirects({
        destination,
        method: "GET",
        timeoutMs,
        signal: options?.signal,
      });
    }

    const ok = result.response.status >= 200 && result.response.status < 400;
    return {
      ok,
      status: ok
        ? result.redirectCount > 0
          ? "redirected"
          : "healthy"
        : "failed",
      httpStatus: result.response.status,
      finalUrl: result.current.toString(),
      redirectCount: result.redirectCount,
      error: ok ? null : `Destination returned HTTP ${result.response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      httpStatus: null,
      finalUrl: destination,
      redirectCount: 0,
      error: error instanceof Error ? error.message.slice(0, 300) : "Destination check failed",
    };
  }
}
