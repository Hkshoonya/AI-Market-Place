import { Code, ExternalLink, Zap, Database, Search, TrendingUp, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "Access AI model data programmatically. Browse models, rankings, benchmarks, pricing, and marketplace listings via our REST API.",
};

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/models",
    description: "List all AI models with pagination, filtering, and sorting.",
    params: [
      { name: "category", type: "string", desc: "Filter by category slug (e.g., llm, image_generation)" },
      { name: "q", type: "string", desc: "Search query for name, provider, or description" },
      { name: "sort", type: "string", desc: "Sort by: rank, downloads, newest, quality" },
      { name: "page", type: "number", desc: "Page number (default: 1)" },
      { name: "limit", type: "number", desc: "Results per page (default: 20, max: 100)" },
    ],
    icon: Database,
  },
  {
    method: "GET",
    path: "/api/models/[slug]",
    description: "Get detailed information about a specific model including benchmarks, pricing, and rankings.",
    params: [
      { name: "slug", type: "string", desc: "Model slug identifier (URL path parameter)" },
    ],
    icon: Zap,
  },
  {
    method: "GET",
    path: "/api/search",
    description: "Full-text search across models and marketplace listings.",
    params: [
      { name: "q", type: "string", desc: "Search query (required)" },
      { name: "limit", type: "number", desc: "Max results (default: 10)" },
    ],
    icon: Search,
  },
  {
    method: "GET",
    path: "/api/rankings",
    description: "Get model rankings and leaderboards.",
    params: [
      { name: "category", type: "string", desc: "Filter by category" },
      { name: "type", type: "string", desc: "Ranking type: overall, category" },
    ],
    icon: TrendingUp,
  },
  {
    method: "GET",
    path: "/api/trending",
    description: "Get trending, newest, and most popular models.",
    params: [
      { name: "category", type: "string", desc: "Filter by category" },
      { name: "limit", type: "number", desc: "Results per list (default: 10)" },
    ],
    icon: TrendingUp,
  },
  {
    method: "GET",
    path: "/api/marketplace/listings",
    description: "Browse marketplace listings for AI models, datasets, APIs, and more.",
    params: [
      { name: "type", type: "string", desc: "Listing type: api_access, model_weights, dataset, etc." },
      { name: "q", type: "string", desc: "Search query" },
      { name: "sort", type: "string", desc: "Sort: newest, price_asc, price_desc, rating, popular" },
      { name: "page", type: "number", desc: "Page number" },
    ],
    icon: ShoppingBag,
  },
];

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Code className="h-6 w-6 text-neon" />
        <h1 className="text-3xl font-bold">API Documentation</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Access AI model data programmatically. Our REST API provides access to
        models, rankings, benchmarks, pricing, and marketplace listings.
      </p>

      {/* Base URL */}
      <Card className="border-border/50 bg-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Base URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-secondary/50 p-4 font-mono text-sm text-neon">
            https://aimarketcap.com/api
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            All endpoints return JSON responses. No authentication is required
            for read-only public endpoints. Rate limits may apply.
          </p>
        </CardContent>
      </Card>

      {/* Response Format */}
      <Card className="border-border/50 bg-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Response Format</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            All API responses follow a consistent JSON format. List endpoints
            include pagination metadata.
          </p>
          <div className="rounded-lg bg-secondary/50 p-4 font-mono text-sm text-foreground/80 overflow-x-auto">
            <pre>{`{
  "data": [...],       // Array of results
  "total": 150,        // Total count
  "page": 1,           // Current page
  "limit": 20          // Results per page
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <h2 className="text-xl font-bold mb-4">Endpoints</h2>
      <div className="space-y-4">
        {API_ENDPOINTS.map((endpoint) => (
          <Card key={endpoint.path} className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <endpoint.icon className="h-5 w-5 text-neon shrink-0" />
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className="bg-neon/10 text-neon border-neon/30 text-xs font-mono font-bold"
                  >
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono font-semibold">
                    {endpoint.path}
                  </code>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {endpoint.description}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {endpoint.params.length > 0 && (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/30 border-b border-border/50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Parameter
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.params.map((param) => (
                        <tr
                          key={param.name}
                          className="border-b border-border/30 last:border-0"
                        >
                          <td className="px-4 py-2">
                            <code className="text-xs font-mono text-neon">
                              {param.name}
                            </code>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-xs text-muted-foreground">
                              {param.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {param.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rate Limits */}
      <Card className="border-border/50 bg-card mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Rate Limits & Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Public API endpoints are rate-limited to ensure fair usage for all
            users.
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>100 requests per minute per IP address</li>
            <li>Responses are cached for up to 60 seconds</li>
            <li>
              For higher rate limits or commercial use, contact us
            </li>
          </ul>
          <p className="text-xs mt-4">
            By using the API, you agree to our{" "}
            <a href="/terms" className="text-neon hover:underline">
              Terms of Service
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
