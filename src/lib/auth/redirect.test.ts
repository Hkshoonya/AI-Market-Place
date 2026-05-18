import { describe, expect, it } from "vitest";

import {
  buildAuthCallbackUrl,
  buildAuthRouteHref,
  sanitizeAuthRedirect,
} from "./redirect";

describe("auth redirect helpers", () => {
  it("accepts safe internal paths", () => {
    expect(sanitizeAuthRedirect("/commons")).toBe("/commons");
  });

  it("rejects external or malformed redirect targets", () => {
    expect(sanitizeAuthRedirect("https://evil.example")).toBe("/");
    expect(sanitizeAuthRedirect("//evil.example")).toBe("/");
    expect(sanitizeAuthRedirect("/https:trap")).toBe("/");
  });

  it("builds auth route hrefs only when a non-root redirect exists", () => {
    expect(buildAuthRouteHref("/signup", "/commons")).toBe(
      "/signup?redirect=%2Fcommons"
    );
    expect(buildAuthRouteHref("/login", "/")).toBe("/login");
  });

  it("always encodes the callback next parameter from the sanitized redirect", () => {
    expect(buildAuthCallbackUrl("https://aimarketcap.tech", "/commons")).toBe(
      "https://aimarketcap.tech/auth/callback?next=%2Fcommons"
    );
    expect(buildAuthCallbackUrl("https://aimarketcap.tech", "https://evil.example")).toBe(
      "https://aimarketcap.tech/auth/callback?next=%2F"
    );
  });
});
