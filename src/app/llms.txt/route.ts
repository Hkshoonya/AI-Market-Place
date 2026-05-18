import { NextResponse } from "next/server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants/site";

const LLMS_TEXT = [
  `# ${SITE_NAME}`,
  "",
  `> ${SITE_DESCRIPTION}`,
  "",
  "AI Market Cap is a public directory and comparison site for AI models, benchmarks, provider evidence, pricing, and marketplace listings.",
  "",
  "## Recommended public URLs",
  `- Home: ${SITE_URL}/`,
  `- Models: ${SITE_URL}/models`,
  `- Leaderboards: ${SITE_URL}/leaderboards`,
  `- Compare: ${SITE_URL}/compare`,
  `- Marketplace: ${SITE_URL}/marketplace`,
  `- Search: ${SITE_URL}/search`,
  `- News: ${SITE_URL}/news`,
  `- About: ${SITE_URL}/about`,
  `- API Docs: ${SITE_URL}/api-docs`,
  `- Sitemap: ${SITE_URL}/sitemap.xml`,
  "",
  "## Notes",
  "- Public catalog, ranking, marketplace, and editorial pages are intended to be discoverable.",
  "- Authenticated user areas, admin pages, and API endpoints are not intended as discovery surfaces.",
].join("\n");

export function GET() {
  return new NextResponse(LLMS_TEXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
