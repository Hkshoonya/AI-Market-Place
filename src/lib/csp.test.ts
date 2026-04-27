import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

describe("buildContentSecurityPolicy", () => {
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
});
