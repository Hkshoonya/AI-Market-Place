import type { Metadata } from "next";
import { ApiDocsContent } from "./api-docs-content";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "Comprehensive API documentation for AI Market Cap. Access models, rankings, marketplace, agents, and MCP protocol endpoints.",
};

export default function ApiDocsPage() {
  return <ApiDocsContent />;
}
