import type { Metadata } from "next";
import { ApiDocsContent } from "./api-docs-content";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "Comprehensive API documentation for AI Market Cap. Access models, rankings, marketplace, agents, and MCP protocol endpoints.",
  openGraph: {
    title: "API Documentation",
    description:
      "Comprehensive API documentation for AI Market Cap. Access models, rankings, marketplace, agents, and MCP protocol endpoints.",
    url: `${SITE_URL}/api-docs`,
  },
  alternates: {
    canonical: `${SITE_URL}/api-docs`,
  },
};

export default function ApiDocsPage() {
  return <ApiDocsContent />;
}
