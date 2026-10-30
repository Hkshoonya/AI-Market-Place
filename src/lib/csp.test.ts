import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

describe("buildContentSecurityPolicy", () => {
  it("allows the configured self-hosted backend only for connections", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      isE2E: false,
      supabaseUrl: "https://api.aimarketcap.tech",
    });
    const directives = Object.fromEntries(policy.split(";").filter(Boolean).map((part) => {
      const [name, ...values] = part.trim().split(" ");
      return [name, values];
    }));
    expect(directives["connect-src"]).toContain("https://api.aimarketcap.tech");
    expect(directives["connect-src"]).toContain("wss://api.aimarketcap.tech");
    expect(directives["script-src"]).not.toContain("https://api.aimarketcap.tech");
  });

  it.each(["http://api.example.com", "https://user:pass@api.example.com", "https://api.example.com:8443", "not a URL"])(
    "rejects an unsafe backend origin: %s", (supabaseUrl) => {
      const policy = buildContentSecurityPolicy({ isDevelopment: false, isE2E: false, supabaseUrl });
      expect(policy).not.toContain("api.example.com");
    },
  );

  it("omits unsafe-eval in production", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      isE2E: false,
    });

    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("includes unsafe-eval in development only", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: true,
      isE2E: false,
    });

    expect(policy).toContain("'unsafe-eval'");
  });

  it("adds local Supabase endpoints for e2e runs", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      isE2E: true,
    });

    expect(policy).toContain("http://localhost:54321");
    expect(policy).toContain("ws://localhost:54321");
  });

  it("adds stricter baseline document and plugin directives", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      isE2E: false,
    });

    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
  });

  it("allows secure remote images for user-provided media", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      isE2E: false,
    });

    expect(policy).toContain("img-src 'self' data: https:");
  });
});
