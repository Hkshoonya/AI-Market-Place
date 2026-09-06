import "server-only";

import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import { isPublicAffiliateAddress, parseSafeAffiliateDestination } from "./url";

export interface AffiliateHealthResult {
  ok: boolean;
  status: "healthy" | "redirected" | "failed";
  httpStatus: number | null;
  finalUrl: string;
  redirectCount: number;
  error: string | null;
}

class DestinationCheckError extends Error {}

function safeDestination(value: string) {
  try {
    return parseSafeAffiliateDestination(value);
  } catch (error) {
    throw new DestinationCheckError(error instanceof Error ? error.message : "Invalid destination");
  }
}

// Node connects to these exact validated answers, without a second DNS lookup.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  void lookup(hostname, { all: true, verbatim: true }).then(
    (records) => {
      if (!records.length || records.some((record) => !isPublicAffiliateAddress(record.address))) {
        callback(new DestinationCheckError("Affiliate destination resolved to a non-public address"), []);
        return;
      }
      if (options.all) callback(null, records);
      else callback(null, records[0].address, records[0].family);
    },
    () => callback(new DestinationCheckError("Destination DNS lookup failed"), [])
  );
};

function requestHeaders(url: URL, method: "HEAD" | "GET", signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<{ status: number; location?: string }>((resolve, reject) => {
    const req = request(url, {
      method,
      agent: false,
      rejectUnauthorized: true,
      lookup: publicLookup,
      signal,
      headers: {
        "User-Agent": "AI-Market-Cap-Affiliate-Maintainer/1.0",
        ...(method === "GET" ? { Range: "bytes=0-1023" } : {}),
      },
    }, (response) => {
      const result = { status: response.statusCode ?? 0, location: response.headers.location };
      // Health checks only need headers, even if the server ignores Range.
      response.destroy();
      resolve(result);
    });
    req.on("error", reject);
    req.end();
  });
}

export async function checkAffiliateDestination(
  destination: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<AffiliateHealthResult> {
  const requestedTimeout = options?.timeoutMs ?? 8_000;
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.max(1, Math.min(30_000, Math.trunc(requestedTimeout)))
    : 8_000;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = options?.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  let redirectCount = 0;

  try {
    let current = safeDestination(destination);
    let method: "HEAD" | "GET" = "HEAD";

    while (true) {
      const response = await requestHeaders(current, method, signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.location) throw new DestinationCheckError("Destination redirect has no Location header");
        if (redirectCount >= 5) throw new DestinationCheckError("Destination exceeded the safe redirect limit");
        current = safeDestination(new URL(response.location, current).toString());
        redirectCount += 1;
        continue;
      }

      if (method === "HEAD" && [400, 403, 405].includes(response.status)) {
        method = "GET";
        current = safeDestination(destination);
        continue;
      }

      const ok = response.status >= 200 && response.status < 300;
      return {
        ok,
        status: ok ? (redirectCount > 0 ? "redirected" : "healthy") : "failed",
        httpStatus: response.status,
        finalUrl: current.toString(),
        redirectCount,
        error: ok ? null : `Destination returned HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      httpStatus: null,
      finalUrl: destination,
      redirectCount,
      error: options?.signal?.aborted
        ? "Destination check cancelled"
        : deadline.aborted
          ? "Destination check timed out"
          : error instanceof DestinationCheckError
            ? error.message
            : "Destination check failed",
    };
  }
}
