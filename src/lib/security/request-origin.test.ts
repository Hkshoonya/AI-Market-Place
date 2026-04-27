import { describe, expect, it } from "vitest";
import {
  hasTrustedRequestOrigin,
  rejectUntrustedRequestOrigin,
  rejectUntrustedSessionOrigin,
} from "./request-origin";

describe("hasTrustedRequestOrigin", () => {
  it("accepts matching origin headers", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: { origin: "https://aimarketcap.tech" },
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

  it("rejects cross-origin requests", () => {
    const request = new Request("https://aimarketcap.tech/api/example", {
      method: "POST",
      headers: { origin: "https://evil.example" },
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
