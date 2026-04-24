import { describe, expect, it } from "vitest";
import { hasTrustedRequestOrigin } from "./request-origin";

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
});
