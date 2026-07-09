import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasTrustedRequestOrigin,
  rejectUntrustedRequestOrigin,
  rejectUntrustedSessionOrigin,
} from "./request-origin";

describe("hasTrustedRequestOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts matching origin headers", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: { origin: "https://aimarketcap.tech" },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(true);
  });

  it("accepts matching origin headers when the host header is the authoritative origin", () => {
    const request = new Request("http://localhost:3000/api/example", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3410",
        origin: "http://127.0.0.1:3410",
      },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(true);
  });

  it("accepts matching referer headers when origin is absent", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: { referer: "https://aimarketcap.tech/dashboard" },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(true);
  });

  it("accepts same-origin browser requests when only sec-fetch-site is present", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin" },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(true);
  });

  it("rejects cross-origin requests", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(false);
  });

  it("does not trust caller-controlled forwarded host headers", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(false);
  });

  it("accepts loopback origins in explicit production E2E mode", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST_MODE", "true");
    const request = new Request("http://127.0.0.1:3000/api/example", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000" },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(true);
  });

  it("rejects loopback origins in production outside explicit E2E mode", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_E2E_MSW", "false");
    const request = new Request("http://127.0.0.1:3000/api/example", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000" },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(false);
  });

  it("rejects requests without origin signals", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
    });

    expect(hasTrustedRequestOrigin(request)).toBe(false);
  });

  it("returns a 403 response for untrusted browser writes", async () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });

    const response = rejectUntrustedRequestOrigin(request);

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "Cross-origin browser requests are not allowed.",
    });
  });

  it("skips origin enforcement for API-key requests", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
    });

    expect(rejectUntrustedSessionOrigin(request, "api_key")).toBeNull();
  });

  it("does not treat guest requests as session-protected writes", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
    });

    expect(rejectUntrustedSessionOrigin(request, null)).toBeNull();
  });
});
