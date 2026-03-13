import { afterEach, describe, expect, it } from "vitest";
import { buildCanonicalUrl, getCanonicalOrigin } from "./site";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

describe("site canonical helpers", () => {
  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      return;
    }

    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
  });

  it("defaults to the production .tech origin when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(getCanonicalOrigin()).toBe("https://aimarketcap.tech");
  });

  it("normalizes configured origins by stripping trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aimarketcap.tech/";

    expect(getCanonicalOrigin()).toBe("https://aimarketcap.tech");
  });

  it("builds canonical absolute URLs from app-relative paths", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aimarketcap.tech/";

    expect(buildCanonicalUrl("/login?error=auth_callback_failed")).toBe(
      "https://aimarketcap.tech/login?error=auth_callback_failed"
    );
  });
});
