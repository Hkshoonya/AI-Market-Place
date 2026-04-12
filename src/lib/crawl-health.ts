import { buildCanonicalUrl, SITE_URL } from "@/lib/constants/site";

export interface CrawlRouteHealth {
  path: string;
  url: string;
  status: number | null;
  ok: boolean;
  contentType: string | null;
  error: string | null;
  warnings: string[];
}

export interface CrawlSurfaceHealth {
  healthy: boolean;
  criticalFailures: number;
  warningCount: number;
  checkedAt: string;
  routes: CrawlRouteHealth[];
  warnings: string[];
}

type FetchLike = typeof fetch;

const GOOGLEBOT_HEADERS = {
  "user-agent": "Googlebot",
};

const CHALLENGE_MARKERS = ["challenge-platform", "__CF$cv$params", "cf-mitigated"];

async function readResponseBody(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function checkHomePage(fetchFn: FetchLike): Promise<CrawlRouteHealth> {
  const url = SITE_URL;
  const warnings: string[] = [];

  try {
    const response = await fetchFn(url, { headers: GOOGLEBOT_HEADERS });
    const contentType = response.headers.get("content-type");
    const body = await readResponseBody(response);

    if (!contentType?.includes("text/html")) {
      warnings.push(`unexpected content type: ${contentType ?? "unknown"}`);
    }

    if (!body.includes('name="googlebot"')) {
      warnings.push("missing googlebot meta tag");
    }

    if (!body.includes(`<link rel="canonical" href="${SITE_URL}`)) {
      warnings.push("missing canonical tag");
    }

    if (CHALLENGE_MARKERS.some((marker) => body.includes(marker))) {
      warnings.push("challenge markers present in public HTML");
    }

    return {
      path: "/",
      url,
      status: response.status,
      ok: response.ok && contentType?.includes("text/html") === true,
      contentType,
      error: null,
      warnings,
    };
  } catch (error) {
    return {
      path: "/",
      url,
      status: null,
      ok: false,
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

async function checkRobots(fetchFn: FetchLike): Promise<CrawlRouteHealth> {
  const path = "/robots.txt";
  const url = buildCanonicalUrl(path);
  const warnings: string[] = [];

  try {
    const response = await fetchFn(url, { headers: GOOGLEBOT_HEADERS });
    const contentType = response.headers.get("content-type");
    const body = await readResponseBody(response);

    if (!contentType?.includes("text/plain")) {
      warnings.push(`unexpected content type: ${contentType ?? "unknown"}`);
    }

    if (!body.includes("Allow: /")) {
      warnings.push("missing site-wide allow rule");
    }

    if (!body.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
      warnings.push("missing sitemap declaration");
    }

    if (body.includes("# BEGIN Cloudflare Managed content")) {
      warnings.push("cloudflare managed robots content detected");
    }

    if (body.includes("User-agent: Google-Extended") && body.includes("Disallow: /")) {
      warnings.push("google-extended disallow present");
    }

    return {
      path,
      url,
      status: response.status,
      ok:
        response.ok &&
        contentType?.includes("text/plain") === true &&
        body.includes("Allow: /") &&
        body.includes(`Sitemap: ${SITE_URL}/sitemap.xml`),
      contentType,
      error: null,
      warnings,
    };
  } catch (error) {
    return {
      path,
      url,
      status: null,
      ok: false,
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

async function checkSitemap(fetchFn: FetchLike): Promise<CrawlRouteHealth> {
  const path = "/sitemap.xml";
  const url = buildCanonicalUrl(path);
  const warnings: string[] = [];

  try {
    const response = await fetchFn(url, { headers: GOOGLEBOT_HEADERS });
    const contentType = response.headers.get("content-type");
    const body = await readResponseBody(response);

    if (!contentType?.includes("xml")) {
      warnings.push(`unexpected content type: ${contentType ?? "unknown"}`);
    }

    if (!body.includes("<urlset")) {
      warnings.push("missing urlset root");
    }

    if (!body.includes(`<loc>${SITE_URL}</loc>`)) {
      warnings.push("missing homepage loc entry");
    }

    return {
      path,
      url,
      status: response.status,
      ok:
        response.ok &&
        contentType?.includes("xml") === true &&
        body.includes("<urlset") &&
        body.includes(`<loc>${SITE_URL}</loc>`),
      contentType,
      error: null,
      warnings,
    };
  } catch (error) {
    return {
      path,
      url,
      status: null,
      ok: false,
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

export async function checkCrawlerSurfaceHealth(
  fetchFn: FetchLike = fetch
): Promise<CrawlSurfaceHealth> {
  const routes = await Promise.all([
    checkHomePage(fetchFn),
    checkRobots(fetchFn),
    checkSitemap(fetchFn),
  ]);

  const warnings = routes.flatMap((route) =>
    route.warnings.map((warning) => `${route.path}: ${warning}`)
  );
  const criticalFailures = routes.filter((route) => !route.ok).length;

  return {
    healthy: criticalFailures === 0,
    criticalFailures,
    warningCount: warnings.length,
    checkedAt: new Date().toISOString(),
    routes,
    warnings,
  };
}
