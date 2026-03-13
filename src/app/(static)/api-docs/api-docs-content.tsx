"use client";

import { useState } from "react";
import { Globe, ShoppingBag, Bot, Server, Key } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Param {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth?: string;
  params?: Param[];
  body?: string;
  example?: string;
}

interface Section {
  title: string;
  endpoints: Endpoint[];
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  { id: "public", label: "Public API", icon: Globe },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { id: "agents", label: "Agents & Bots", icon: Bot },
  { id: "mcp", label: "MCP Protocol", icon: Server },
  { id: "auth", label: "Authentication", icon: Key },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Method badge colours
// ---------------------------------------------------------------------------
const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  PATCH: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

// ---------------------------------------------------------------------------
// Endpoint data per tab
// ---------------------------------------------------------------------------
const PUBLIC_SECTIONS: Section[] = [
  {
    title: "Models",
    endpoints: [
      {
        method: "GET",
        path: "/api/models",
        description: "List all AI models with pagination, filtering, and sorting.",
        params: [
          { name: "category", type: "string", description: "Filter by category slug (e.g. llm, image_generation)" },
          { name: "q", type: "string", description: "Search query for name, provider, or description" },
          { name: "sort", type: "string", description: "Sort by: rank, downloads, newest, quality" },
          { name: "page", type: "number", description: "Page number (default: 1)" },
          { name: "limit", type: "number", description: "Results per page (default: 20, max: 100)" },
        ],
        example: `{
  "data": [
    { "slug": "gpt-4o", "name": "GPT-4o", "provider": "OpenAI", "rank": 1, "category": "llm" }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}`,
      },
      {
        method: "GET",
        path: "/api/models/[slug]",
        description: "Get detailed information about a specific model including benchmarks, pricing, and rankings.",
        params: [
          { name: "slug", type: "string", description: "Model slug identifier (URL path parameter)", required: true },
        ],
        example: `{
  "slug": "gpt-4o",
  "name": "GPT-4o",
  "provider": "OpenAI",
  "rank": 1,
  "benchmarks": { "mmlu": 88.7 },
  "pricing": { "input": 2.5, "output": 10.0 }
}`,
      },
    ],
  },
  {
    title: "Search & Discovery",
    endpoints: [
      {
        method: "GET",
        path: "/api/search",
        description: "Unified full-text search across models and marketplace listings.",
        params: [
          { name: "q", type: "string", description: "Search query", required: true },
          { name: "limit", type: "number", description: "Max results (default: 10)" },
        ],
        example: `{
  "models": [{ "slug": "gpt-4o", "name": "GPT-4o" }],
  "listings": [{ "slug": "gpt4-api-access", "title": "GPT-4 API Access" }]
}`,
      },
      {
        method: "GET",
        path: "/api/rankings",
        description: "Get model rankings and leaderboards.",
        params: [
          { name: "category", type: "string", description: "Filter by category" },
          { name: "type", type: "string", description: "Ranking type: overall, category" },
        ],
        example: `{
  "data": [
    { "rank": 1, "slug": "gpt-4o", "score": 95.2 },
    { "rank": 2, "slug": "claude-3-opus", "score": 94.8 }
  ]
}`,
      },
      {
        method: "GET",
        path: "/api/trending",
        description: "Get trending, newest, and most popular models.",
        params: [
          { name: "category", type: "string", description: "Filter by category" },
          { name: "limit", type: "number", description: "Results per list (default: 10)" },
        ],
        example: `{
  "trending": [{ "slug": "gpt-4o", "name": "GPT-4o" }],
  "newest": [{ "slug": "llama-4", "name": "Llama 4" }],
  "popular": [{ "slug": "claude-3-opus", "name": "Claude 3 Opus" }]
}`,
      },
    ],
  },
];

const MARKETPLACE_SECTIONS: Section[] = [
  {
    title: "Listings",
    endpoints: [
      {
        method: "GET",
        path: "/api/marketplace/listings",
        description: "Browse marketplace listings for AI models, datasets, APIs, and more.",
        params: [
          { name: "type", type: "string", description: "Listing type: api_access, model_weights, fine_tuned_model, dataset, prompt_template, agent, mcp_server" },
          { name: "q", type: "string", description: "Search query" },
          { name: "sort", type: "string", description: "Sort: newest, price_asc, price_desc, rating, popular" },
          { name: "page", type: "number", description: "Page number (default: 1)" },
        ],
        example: `{
  "data": [
    { "slug": "gpt4-api", "title": "GPT-4 API Access", "price": 29.99, "type": "api_access" }
  ],
  "total": 42,
  "page": 1
}`,
      },
      {
        method: "GET",
        path: "/api/marketplace/listings/[slug]",
        description: "Get full details for a specific marketplace listing.",
        params: [
          { name: "slug", type: "string", description: "Listing slug (URL path parameter)", required: true },
        ],
        example: `{
  "slug": "gpt4-api",
  "title": "GPT-4 API Access",
  "description": "...",
  "price": 29.99,
  "seller": { "username": "openai-partner" },
  "rating": 4.8
}`,
      },
      {
        method: "POST",
        path: "/api/marketplace/listings",
        description: "Create a new marketplace listing.",
        auth: "Bearer token required. Scope: marketplace or write.",
        body: `{
  "title": "My Dataset",
  "description": "High-quality training data...",
  "type": "dataset",
  "price": 49.99,
  "modelSlug": "gpt-4o"     // optional, link to a model
}`,
        example: `{
  "slug": "my-dataset-abc123",
  "title": "My Dataset",
  "status": "draft"
}`,
      },
    ],
  },
  {
    title: "Orders",
    endpoints: [
      {
        method: "POST",
        path: "/api/marketplace/orders",
        description: "Create a new order for a marketplace listing.",
        auth: "Bearer token required. Scope: marketplace or write.",
        body: `{
  "listingId": "listing_abc123",
  "quantity": 1
}`,
        example: `{
  "orderId": "ord_xyz789",
  "status": "completed",
  "total": 29.99
}`,
      },
      {
        method: "GET",
        path: "/api/marketplace/orders",
        description: "List your orders with status and details.",
        auth: "Bearer token required. Scope: marketplace or read.",
        params: [
          { name: "status", type: "string", description: "Filter: pending, completed, refunded" },
          { name: "page", type: "number", description: "Page number" },
        ],
        example: `{
  "data": [
    { "orderId": "ord_xyz789", "listing": "GPT-4 API Access", "status": "completed" }
  ],
  "total": 5
}`,
      },
    ],
  },
  {
    title: "Seller Funds",
    endpoints: [
      {
        method: "GET",
        path: "/api/seller/withdraw",
        description: "Get supported withdrawal chains and seller payout metadata.",
        auth: "Bearer token required. Scope: withdraw, marketplace, or read.",
        example: `{
  "chains": [
    { "id": "solana", "label": "Solana", "token": "USDC" }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/seller/withdraw",
        description: "Initiate a seller wallet withdrawal to a supported on-chain address.",
        auth: "Bearer token required. Scope: withdraw.",
        body: `{
  "amount": 125.50,
  "chain": "solana",
  "wallet_address": "7Yw9...abc"
}`,
        example: `{
  "success": true,
  "tx_id": "withdrawal_abc123",
  "amount": 125.5,
  "chain": "solana"
}`,
      },
    ],
  },
];

const AGENT_SECTIONS: Section[] = [
  {
    title: "Chat",
    endpoints: [
      {
        method: "POST",
        path: "/api/agents/chat",
        description: "Send a message to an AI agent and receive a response. Creates a new conversation if none exists.",
        auth: "API key required. Scope: agent.",
        body: `{
  "agent_slug": "pipeline-engineer",  // required — target agent
  "message": "What is the health of the data pipeline?",  // required
  "topic": "Pipeline Health"  // optional conversation topic
}`,
        example: `{
  "conversation_id": "conv_abc",
  "message": { "id": "msg_1", "content": "What is the health..." },
  "response": { "id": "msg_2", "content": "The pipeline is healthy..." }
}`,
      },
    ],
  },
  {
    title: "Conversations",
    endpoints: [
      {
        method: "GET",
        path: "/api/agents/conversations",
        description: "List your agent conversations.",
        auth: "API key required. Scope: agent.",
        params: [
          { name: "limit", type: "number", description: "Max results (default: 20)" },
        ],
        example: `{
  "data": [
    { "id": "conv_abc", "title": "Model comparison", "updatedAt": "2025-01-15T..." }
  ]
}`,
      },
      {
        method: "GET",
        path: "/api/agents/conversations/[id]/messages",
        description: "Retrieve all messages in a conversation.",
        auth: "API key required. Scope: agent.",
        params: [
          { name: "id", type: "string", description: "Conversation ID (URL path parameter)", required: true },
        ],
        example: `{
  "data": [
    { "role": "user", "content": "Compare GPT-4o and Claude 3 Opus" },
    { "role": "assistant", "content": "Here is a comparison..." }
  ]
}`,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// MCP content (not endpoint-based, rendered as prose)
// ---------------------------------------------------------------------------
const MCP_TOOLS = [
  { name: "search_models", description: "Search AI models by query, category, or provider" },
  { name: "get_model", description: "Get detailed info for a specific model by slug" },
  { name: "list_rankings", description: "Retrieve current model rankings and leaderboards" },
  { name: "get_trending", description: "Get trending, newest, and most popular models" },
  { name: "browse_marketplace", description: "Browse marketplace listings with filters" },
  { name: "get_listing", description: "Get details for a specific marketplace listing" },
  { name: "create_order", description: "Place an order for a marketplace listing" },
  { name: "list_agents", description: "List available AI agents" },
  { name: "send_message", description: "Send a message to a resident agent and get a response" },
];

const MCP_RESOURCES = [
  { uri: "models://catalog", description: "Full AI model catalog" },
  { uri: "rankings://leaderboard", description: "Current model leaderboard" },
  { uri: "marketplace://listings", description: "Active marketplace listings" },
  { uri: "agents://directory", description: "Available agent directory" },
];

const MCP_PROMPTS = [
  { name: "compare_models", description: "Generate a structured comparison between two or more models" },
  { name: "recommend_model", description: "Get a model recommendation based on use case requirements" },
];

// ===========================================================================
// Component
// ===========================================================================
export function ApiDocsContent() {
  const [activeTab, setActiveTab] = useState<TabId>("public");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Header */}
      <h1 className="text-3xl font-bold mb-1">API Documentation</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Access AI Market Cap data programmatically. Public endpoints require no
        authentication. Protected endpoints use API key authentication.
      </p>

      {/* Base URL banner */}
      <div className="rounded-lg border border-border/50 bg-card p-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-sm text-muted-foreground shrink-0">Base URL</span>
        <code className="font-mono text-sm text-neon">https://aimarketcap.tech</code>
      </div>

      {/* Layout: sidebar + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar / mobile tabs */}
        <nav className="lg:w-52 shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-20">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-neon/10 text-neon"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {activeTab === "public" && <EndpointSections sections={PUBLIC_SECTIONS} />}
          {activeTab === "marketplace" && <EndpointSections sections={MARKETPLACE_SECTIONS} />}
          {activeTab === "agents" && <EndpointSections sections={AGENT_SECTIONS} />}
          {activeTab === "mcp" && <McpSection />}
          {activeTab === "auth" && <AuthSection />}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Endpoint sections renderer
// ===========================================================================
function EndpointSections({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-lg font-semibold mb-4 sticky top-0 bg-background/80 backdrop-blur-sm py-2 -mt-2 z-10 border-b border-border/30">
            {section.title}
          </h2>
          <div className="space-y-6">
            {section.endpoints.map((ep) => (
              <EndpointCard key={ep.method + ep.path} endpoint={ep} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// Single endpoint card
// ===========================================================================
function EndpointCard({ endpoint: ep }: { endpoint: Endpoint }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-bold ${METHOD_COLORS[ep.method]}`}
          >
            {ep.method}
          </span>
          <code className="text-sm font-mono font-semibold">{ep.path}</code>
          {ep.auth && (
            <span className="ml-auto text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-2 py-0.5">
              Auth Required
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{ep.description}</p>
        {ep.auth && (
          <p className="text-xs text-muted-foreground mt-1 italic">{ep.auth}</p>
        )}
      </div>

      {/* Params table */}
      {ep.params && ep.params.length > 0 && (
        <div className="border-b border-border/30">
          <div className="px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Parameters
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/20 border-b border-border/30">
                <th className="px-5 py-1.5 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-5 py-1.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-1.5 text-left text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {ep.params.map((p) => (
                <tr key={p.name} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-2">
                    <code className="text-xs font-mono text-neon">{p.name}</code>
                    {p.required && <span className="text-red-400 ml-1 text-xs">*</span>}
                  </td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{p.type}</td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Request body */}
      {ep.body && (
        <div className="border-b border-border/30">
          <div className="px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Request Body
          </div>
          <div className="px-5 pb-4">
            <pre className="rounded-lg bg-black/60 border border-border/30 p-4 text-xs font-mono text-foreground/80 overflow-x-auto">
              {ep.body}
            </pre>
          </div>
        </div>
      )}

      {/* Example response */}
      {ep.example && (
        <div>
          <div className="px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Example Response
          </div>
          <div className="px-5 pb-4">
            <pre className="rounded-lg bg-black/60 border border-border/30 p-4 text-xs font-mono text-foreground/80 overflow-x-auto">
              {ep.example}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// MCP Protocol section
// ===========================================================================
function McpSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-2">MCP Protocol</h2>
        <p className="text-sm text-muted-foreground mb-4">
          AI Market Cap implements the{" "}
          <span className="text-foreground font-medium">Model Context Protocol (MCP)</span>{" "}
          over a single JSON-RPC 2.0 endpoint. Connect any MCP-compatible client
          (Claude Desktop, Cursor, etc.) to access models, rankings, marketplace, and
          agents as structured tools and resources.
        </p>
      </div>

      {/* Endpoint */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-bold ${METHOD_COLORS.POST}`}>
            POST
          </span>
          <code className="text-sm font-mono font-semibold">/api/mcp</code>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          JSON-RPC 2.0 endpoint. Send <code className="text-neon">initialize</code>,{" "}
          <code className="text-neon">tools/list</code>,{" "}
          <code className="text-neon">tools/call</code>,{" "}
          <code className="text-neon">resources/list</code>,{" "}
          <code className="text-neon">resources/read</code>, and{" "}
          <code className="text-neon">prompts/list</code> methods.
        </p>
        <pre className="rounded-lg bg-black/60 border border-border/30 p-4 text-xs font-mono text-foreground/80 overflow-x-auto">
{`// Example: call a tool
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_models",
    "arguments": { "query": "GPT" }
  }
}`}
        </pre>
      </div>

      {/* Tools */}
      <div>
        <h3 className="text-md font-semibold mb-3">Tools</h3>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/20 border-b border-border/30">
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Tool</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {MCP_TOOLS.map((t) => (
                <tr key={t.name} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-2">
                    <code className="text-xs font-mono text-neon">{t.name}</code>
                  </td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resources */}
      <div>
        <h3 className="text-md font-semibold mb-3">Resources</h3>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/20 border-b border-border/30">
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">URI</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {MCP_RESOURCES.map((r) => (
                <tr key={r.uri} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-2">
                    <code className="text-xs font-mono text-neon">{r.uri}</code>
                  </td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prompts */}
      <div>
        <h3 className="text-md font-semibold mb-3">Prompts</h3>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/20 border-b border-border/30">
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Prompt</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {MCP_PROMPTS.map((p) => (
                <tr key={p.name} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-2">
                    <code className="text-xs font-mono text-neon">{p.name}</code>
                  </td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Authentication section
// ===========================================================================
function AuthSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-2">Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Public read-only endpoints (models, rankings, search, trending) require no
          authentication. Protected endpoints (marketplace write, agents, MCP) require
          an API key.
        </p>
      </div>

      {/* Creating API keys */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-md font-semibold mb-3">Creating API Keys</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Sign in to your AI Market Cap account</li>
          <li>
            Navigate to{" "}
            <a href="/settings/api-keys" className="text-neon hover:underline">
              Settings &rarr; API Keys
            </a>
          </li>
          <li>Click &quot;Create New Key&quot; and select the scopes you need</li>
          <li>Copy your key immediately &mdash; it will only be shown once</li>
        </ol>
      </div>

      {/* Key format */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-md font-semibold mb-3">Key Format</h3>
        <p className="text-sm text-muted-foreground mb-3">
          All API keys use the <code className="text-neon">aimk_</code> prefix followed by a
          random string.
        </p>
        <pre className="rounded-lg bg-black/60 border border-border/30 p-4 text-xs font-mono text-foreground/80 overflow-x-auto">
{`Authorization: Bearer aimk_abc123def456...`}
        </pre>
      </div>

      {/* Scopes */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-md font-semibold mb-3">Scopes</h3>
        <div className="overflow-hidden rounded-lg border border-border/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/20 border-b border-border/30">
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Scope</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Access</th>
              </tr>
            </thead>
            <tbody>
              {[
                { scope: "read", access: "Read-only access to all public endpoints" },
                { scope: "write", access: "Create and update resources (listings, reviews)" },
                { scope: "agent", access: "Chat with AI agents, manage conversations" },
                { scope: "mcp", access: "Access the MCP JSON-RPC endpoint" },
                { scope: "marketplace", access: "Create listings, place orders, and manage marketplace data" },
                { scope: "withdraw", access: "Initiate seller wallet withdrawals" },
              ].map((s) => (
                <tr key={s.scope} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-2">
                    <code className="text-xs font-mono text-neon">{s.scope}</code>
                  </td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{s.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate limits */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-md font-semibold mb-3">Rate Limits</h3>
        <div className="overflow-hidden rounded-lg border border-border/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/20 border-b border-border/30">
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Tier</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Limit</th>
                <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">Window</th>
              </tr>
            </thead>
            <tbody>
              {[
                { tier: "Unauthenticated", limit: "30 req", window: "per minute" },
                { tier: "Authenticated (default)", limit: "60 req", window: "per minute" },
                { tier: "Agent / MCP", limit: "30 req", window: "per minute" },
              ].map((r) => (
                <tr key={r.tier} className="border-b border-border/20 last:border-0">
                  <td className="px-5 py-2 text-xs text-foreground">{r.tier}</td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{r.limit}</td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{r.window}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Rate limit headers (<code className="text-neon">X-RateLimit-Limit</code>,{" "}
          <code className="text-neon">X-RateLimit-Remaining</code>,{" "}
          <code className="text-neon">X-RateLimit-Reset</code>) are included in every response.
          Exceeding the limit returns <code className="text-neon">429 Too Many Requests</code>.
        </p>
      </div>

      {/* Usage example */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-md font-semibold mb-3">Usage Example</h3>
        <pre className="rounded-lg bg-black/60 border border-border/30 p-4 text-xs font-mono text-foreground/80 overflow-x-auto">
{`# Public endpoint (no auth needed)
curl https://aimarketcap.tech/api/models?category=llm&limit=5

# Authenticated endpoint
curl -H "Authorization: Bearer aimk_your_key_here" \\
  https://aimarketcap.tech/api/agents/chat \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"agent_slug": "pipeline-engineer", "message": "Compare top LLMs"}'`}
        </pre>
      </div>

      <p className="text-xs text-muted-foreground">
        By using the API you agree to our{" "}
        <a href="/terms" className="text-neon hover:underline">Terms of Service</a>.
        For questions or higher rate limits, visit our{" "}
        <a href="/contact" className="text-neon hover:underline">Contact page</a>.
      </p>
    </div>
  );
}
