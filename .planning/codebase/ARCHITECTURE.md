# Architecture

**Analysis Date:** 2026-03-02

## Pattern Overview

**Overall:** Next.js Full-Stack Application with Feature-Based Routing

The codebase uses Next.js 16's App Router with route groups to organize features. Key characteristics:
- Server-side rendering with static generation for public pages (60s revalidation)
- Real-time client-side state management via Supabase Auth context
- API layer handling authentication, rate limiting, and paywall logic
- Modular data pipeline with agents, data sources, and scoring calculators
- Marketplace feature with auctions, listings, and escrow management

## Layers

**Presentation Layer (Components):**
- Purpose: React Server Components (RSC) and Client Components (use client)
- Location: `src/components/`
- Contains: UI components, charts, forms, authentication UI
- Depends on: `src/lib/supabase/`, formatting utilities, type definitions
- Used by: Page routes in `src/app/()`

**Page & Route Layer:**
- Purpose: Entry points for all features and APIs
- Location: `src/app/`
- Contains: Page components, API routes, layout definitions, error boundaries
- Depends on: Supabase clients, lib utilities, components
- Used by: Next.js router (driven by file structure)
- Grouping strategy: Route groups by feature
  - `(catalog)`: Public model discovery, comparisons, rankings
  - `(marketplace)`: Seller/buyer dashboard, listings, auctions, orders
  - `(auth)`: Protected user features (profile, settings, wallet, watchlists)
  - `(admin)`: Admin-only management interfaces
  - `api/`: Public and authenticated API endpoints

**Service/Library Layer:**
- Purpose: Business logic, external integrations, utilities
- Location: `src/lib/`
- Contains: Data source adapters, agents, scoring calculators, payment logic
- Depends on: Supabase, external APIs (Anthropic, Solana, etc.), environment variables
- Used by: Page routes and API handlers

**Data Access Layer:**
- Purpose: Supabase client initialization and configuration
- Location: `src/lib/supabase/`
- Contains: Server-side client, browser client, admin client
- Depends on: Supabase SDK, environment variables
- Used by: All layers requiring database access

## Data Flow

**Homepage Load (Static Generation):**
1. `src/app/page.tsx` (Server Component) initializes during build time
2. Calls `createClient()` from `src/lib/supabase/server.ts`
3. Queries models, benchmarks, rankings from Supabase
4. Renders static HTML with dynamic components (CountUp, charts)
5. Client revalidates every 60 seconds

**Model Detail Page:**
1. User navigates to `/models/[slug]`
2. `src/app/(catalog)/models/[slug]/page.tsx` generates metadata and fetches model data
3. `generateMetadata()` runs on server to build OG tags
4. Server Component fetches from Supabase: model, benchmarks, rankings, pricing
5. Renders charts (BenchmarkRadar, TradingChart) and similar models section
6. Client-side components handle interactions (bookmarks, shares)

**Agent Chat API (Rate-Limited, Authenticated):**
1. Client sends POST to `src/app/api/agents/chat/route.ts`
2. Extracts API key from Authorization header
3. Validates key via `src/lib/agents/auth.ts`
4. Rate limits per API key using `src/lib/rate-limit.ts`
5. Finds or creates conversation
6. Calls Anthropic SDK to generate response via `src/lib/agents/chat.ts`
7. Records message and response in Supabase
8. Returns streamed response to client

**Marketplace Purchase Flow:**
1. User clicks purchase on listing detail page
2. Client opens shadcn Dialog with purchase form
3. POST to `src/app/api/marketplace/purchase/route.ts`
4. Paywall middleware checks caller type (human/bot/public)
5. If human: checks Supabase wallet balance via `src/lib/payments/wallet.ts`
6. Debits wallet using `debitWallet()`
7. Creates order record, initializes escrow
8. Sends confirmation and delivery link
9. Redirects to order details page

**Data Sync Pipeline (Cron-Triggered):**
1. Admin endpoint `src/app/api/admin/sync/[source]/route.ts` receives trigger
2. Calls `executeSync()` from `src/lib/data-sources/orchestrator.ts`
3. Orchestrator loads enabled data sources for tier
4. For each source: retrieves adapter via `src/lib/data-sources/registry.ts`
5. Adapter (e.g., HuggingFace, Anthropic) fetches external data
6. Updates models, benchmarks, pricing tables in Supabase
7. Records sync_jobs result with metrics
8. Agent runtime calls scoring calculators on updated data

**Agent Execution (Scheduled):**
1. External cron hits `src/app/api/cron/agents/[slug]/route.ts`
2. Calls `executeAgent()` from `src/lib/agents/runtime.ts`
3. Loads agent config from Supabase (slug, type, schedule)
4. Creates agent_tasks record with status "running"
5. Loads resident agent instance via `src/lib/agents/registry.ts`
6. Executes agent with timeout, abort signal, context
7. Records task result with output or errors
8. Updates last_run_at timestamp

**State Management:**
- **Auth State:** Context via `src/components/auth/auth-provider.tsx`
  - Singleton Supabase client on browser
  - Listens to onAuthStateChange events
  - Fetches profile from `profiles` table on login
  - Available globally via `useAuth()` hook
- **Server-Side Caching:** Next.js fetch caching + manual revalidate
- **Client-Side State:** React useState for forms, UI state
- **Rate Limit State:** In-memory counter map in `src/lib/rate-limit.ts` (keyed by IP/API key)
- **Pricing Rules Cache:** 5-minute TTL cache in `src/lib/middleware/api-paywall.ts`

## Key Abstractions

**Agent Pattern:**
- Purpose: Autonomous tasks that run on schedule or via API
- Examples: `src/lib/agents/residents/` (weather-bot, news-bot, market-analyst)
- Pattern: Registry-based loading, task creation, result recording
- Interface: `AgentRecord`, `AgentTask`, `AgentContext`, `AgentTaskResult` in `src/lib/agents/types.ts`

**Data Source Adapter:**
- Purpose: Fetch and normalize external model/benchmark data
- Examples: `src/lib/data-sources/adapters/` (huggingface.ts, anthropic.ts)
- Pattern: Registry-based, sequential execution, error handling with retry
- Interface: `DataSourceRecord`, `SyncResult` in `src/lib/data-sources/types.ts`

**Scoring Calculator:**
- Purpose: Compute composite metrics (quality, market-cap, agent rank)
- Examples: `src/lib/scoring/quality-calculator.ts`, `market-cap-calculator.ts`
- Pattern: Category-weighted profiles, signal normalization, fallback logic
- Input: Model record with benchmarks, pricing, community signals
- Output: Normalized 0-100 score

**Paywall Middleware:**
- Purpose: Classify requests, enforce rate limits, debit wallets
- Location: `src/lib/middleware/api-paywall.ts`
- Pattern: Caller classification (human/bot/public), pricing rule matching, transaction logging
- Used by: Protected API endpoints that need billing

**Marketplace Escrow:**
- Purpose: Hold payment until delivery confirmed
- Location: `src/lib/marketplace/escrow.ts`
- Pattern: Order state machine (pending → held → released/disputed)
- Integrates with: Solana wallet transfers, dispute resolution

## Entry Points

**Web Server:**
- Location: `src/app/layout.tsx`
- Triggers: HTTP request to any route
- Responsibilities: Wraps with auth context, tooltips, toaster, PWA register, global styles

**API Routes (Dynamic):**
- Catalog: `src/app/api/models/*` - Model filtering, search
- Agents: `src/app/api/agents/chat/route.ts` - Chat completion with streaming
- Marketplace: `src/app/api/marketplace/*` - Listings, orders, auctions CRUD
- Admin: `src/app/api/admin/*` - Bootstrap, data sync, moderation
- Public: `/api/charts/*` - Pre-computed chart data

**Cron/Scheduled:**
- `src/app/api/cron/` - External cron job handlers for agents and data sync

**Client-Side Initialization:**
- `src/components/auth/auth-provider.tsx` - Auth state listener
- `src/components/pwa-register.tsx` - Service worker registration

## Error Handling

**Strategy:** Hierarchical error boundaries with fallback UI

**Patterns:**
- **Server Components:** Use `notFound()` for 404, throw error for 500
- **Client Components:** Try-catch with toast notifications (via `sonner`)
- **API Routes:** `ApiError` class with statusCode, standardized JSON response
- **Async Operations:** Promise.catch with error toast and state reset
- **Fallback UI:** Global `error.tsx` and `not-found.tsx` in `src/app/`
- **Logging:** Console.error in dev, structured logs to analytics in prod

**Example from `src/lib/api-error.ts`:**
```typescript
export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.statusCode });
  }
  console.error("Unexpected API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
```

## Cross-Cutting Concerns

**Logging:**
- Approach: Console in development, structured JSON to stdout for production log aggregation
- Format: `src/lib/logging.ts` provides tagged loggers by module
- Usage: `logUserAction()`, `logAgentExecution()`, `logSyncResult()`

**Validation:**
- Approach: Zod schemas where complex; runtime type guards where simple
- Examples: API request bodies validated before processing
- Custom: `src/lib/utils/sanitize.ts` for XSS prevention on user content

**Authentication:**
- Approach: Supabase Auth (JWT in cookies + browser storage)
- Server-side: Extract from cookies via `createClient()` in `src/lib/supabase/server.ts`
- Client-side: Managed by Supabase SDK in `src/lib/supabase/client.ts`
- API Routes: Bearer token auth for API keys (`aimk_*` prefix)

**Authorization:**
- Scope-based for API keys: `hasScope(keyRecord, 'agent')`
- Role-based for UI: Check `profile.is_admin`, `profile.is_seller` from `AuthContext`
- Row-level security: Supabase RLS policies on all tables (not enforced in service role)

**Rate Limiting:**
- Approach: In-memory sliding window counter map
- Keys: `{endpoint}:{userId|apiKeyId|ip}`
- Configured per endpoint: `src/lib/rate-limit.ts` exports `RATE_LIMITS.web` and `.api`
- Fallback: Public endpoints limited by IP; paid APIs by wallet state

---

*Architecture analysis: 2026-03-02*
