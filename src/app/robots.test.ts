import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/constants/site";
import robots from "./robots";

describe("robots metadata route", () => {
  it("allows crawling public pages and points to the sitemap", () => {
    const metadata = robots();

    expect(metadata.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(metadata.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userAgent: "*",
          allow: "/",
          disallow: ["/api/"],
        }),
      ])
    );
  });
});
