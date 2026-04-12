import { describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/constants/site";
import { checkCrawlerSurfaceHealth } from "./crawl-health";

describe("checkCrawlerSurfaceHealth", () => {
  it("marks the crawler surface healthy when homepage, robots, and sitemap are valid", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) {
        return new Response(
          `<!doctype html><html><head><meta name="googlebot" content="index, follow" /><link rel="canonical" href="${SITE_URL}" /></head><body></body></html>`,
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
        );
      }

      if (url === `${SITE_URL}/robots.txt`) {
        return new Response(`User-Agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>${SITE_URL}</loc></url></urlset>`,
        { status: 200, headers: { "content-type": "application/xml" } }
      );
    });

    const result = await checkCrawlerSurfaceHealth(fetchMock as typeof fetch);

    expect(result.healthy).toBe(true);
    expect(result.criticalFailures).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.routes).toHaveLength(3);
  });

  it("flags critical failures and challenge warnings when crawler-facing routes are degraded", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === SITE_URL) {
        return new Response(
          `<!doctype html><html><head><script>window.__CF$cv$params={}</script></head><body></body></html>`,
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
        );
      }

      if (url === `${SITE_URL}/robots.txt`) {
        return new Response("# BEGIN Cloudflare Managed content\nUser-Agent: *\nDisallow: /\n", {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      return new Response("boom", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    });

    const result = await checkCrawlerSurfaceHealth(fetchMock as typeof fetch);

    expect(result.healthy).toBe(false);
    expect(result.criticalFailures).toBeGreaterThan(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/: challenge markers present in public HTML"),
        expect.stringContaining("/robots.txt: cloudflare managed robots content detected"),
      ])
    );
  });
});
