import { describe, expect, it } from "vitest";

import {
  isPublicAffiliateAddress,
  parseSafeAffiliateDestination,
  sanitizeAffiliateSource,
} from "./url";

describe("affiliate URL safety", () => {
  it("accepts normal HTTPS destinations", () => {
    expect(
      parseSafeAffiliateDestination("https://replicate.com/meta/model?ref=aimarketcap")
        .hostname
    ).toBe("replicate.com");
  });

  it.each([
    "http://example.com/path",
    "https://user:password@example.com/path",
    "https://example.com:8443/path",
    "https://localhost/path",
    "https://service.internal/path",
    "https://127.0.0.1/path",
    "https://2130706433/path",
    "https://169.254.169.254/latest/meta-data",
    "https://192.168.1.1/path",
    "https://[::1]/path",
    "https://[::ffff:127.0.0.1]/path",
  ])("rejects non-public destination %s", (destination) => {
    expect(() => parseSafeAffiliateDestination(destination)).toThrow();
  });

  it("classifies resolved public and reserved addresses", () => {
    expect(isPublicAffiliateAddress("1.1.1.1")).toBe(true);
    expect(isPublicAffiliateAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicAffiliateAddress("10.0.0.1")).toBe(false);
    expect(isPublicAffiliateAddress("::ffff:7f00:1")).toBe(false);
  });

  it("normalizes click sources to a bounded aggregate key", () => {
    expect(sanitizeAffiliateSource(" Model Card / CTA ")).toBe("model-card-cta");
    expect(sanitizeAffiliateSource("***")).toBe("unknown");
  });

  it.each(["192.0.10.1", "192.2.1.1", "198.51.101.1", "203.0.114.1"])(
    "does not block a public IPv4 range adjacent to reserved space: %s", (address) => {
      expect(isPublicAffiliateAddress(address)).toBe(true);
    }
  );

  it.each(["192.0.2.1", "198.51.100.1", "203.0.113.1", "0:0:0:0:0:0:0:1", "2002:7f00:1::", "3fff::1"])(
    "blocks reserved, expanded and transition addresses: %s", (address) => {
      expect(isPublicAffiliateAddress(address)).toBe(false);
    }
  );
});
