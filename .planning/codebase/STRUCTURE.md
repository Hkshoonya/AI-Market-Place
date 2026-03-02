# Codebase Structure

**Analysis Date:** 2026-03-02

## Directory Layout

```
/f/BotProject/AI Market Cap/
├── src/                           # All source code
│   ├── app/                       # Next.js App Router (pages + API routes)
│   │   ├── (admin)/               # Admin-only pages
│   │   │   └── admin/             # Dashboard, agents, data-sources, analytics
│   │   ├── (auth)/                # Protected user pages (requires login)
│   │   │   ├── activity/          # User transaction history
│   │   │   ├── orders/            # Marketplace order management
│   │   │   ├── profile/           # User profile edit
│   │   │   ├── settings/          # Account settings, API keys
│   │   │   ├── wallet/            # Wallet balance and transactions
│   │   │   └── watchlists/        # Saved model lists
│   │   ├── (catalog)/             # Public model discovery
│   │   │   ├── models/            # Model detail pages
│   │   │   ├── categories/        # Category browse
│   │   │   ├── providers/         # Provider detail pages
│   │   │   ├── discover/          # Discovery feed
│   │   │   ├── search/            # Search results
│   │   │   └── skills/            # AI skills taxonomy
│   │   ├── (marketplace)/         # Marketplace (seller/buyer)
│   │   │   └── dashboard/         # Seller dashboard, listings, orders
│   │   ├── (rankings)/            # Leaderboards and rankings
│   │   ├── (static)/              # Static pages (about, legal)
│   │   ├── api/                   # API routes (server endpoints)
│   │   │   ├── admin/             # Admin endpoints (sync, bootstrap, moderate)
│   │   │   ├── agents/            # Agent endpoints (chat, conversations)
│   │   │   ├── api-keys/          # API key management
│   │   │   ├── auth/              # Auth endpoints (delete account)
│   │   │   ├── charts/            # Pre-computed chart data
│   │   │   ├── cron/              # Scheduled job endpoints
│   │   │   ├── marketplace/       # Marketplace CRUD (listings, orders, auctions)
│   │   │   ├── models/            # Model search and filtering
│   │   │   └── payments/          # Payment and wallet endpoints
│   │   ├── compare/               # Compare page (query-param driven)
│   │   ├── auth/                  # Auth pages (login, signup, reset)
│   │   ├── layout.tsx             # Root layout (wraps all routes)
│   │   ├── page.tsx               # Homepage
│   │   ├── error.tsx              # Global error boundary
│   │   ├── globals.css            # Global styles (Tailwind + custom)
│   │   └── favicon.ico
│   ├── components/                # React components (Server + Client)
│   │   ├── auth/                  # Auth UI (login form, auth context provider)
│   │   ├── charts/                # Chart components (Recharts, Three.js based)
│   │   ├── layout/                # Layout components (header, footer, navigation)
│   │   ├── marketplace/           # Marketplace UI (listings, forms, filters)
│   │   ├── models/                # Model display (cards, detail sections, benchmarks)
│   │   ├── shared/                # Shared UI (provider logo, badges, tooltips)
│   │   ├── three/                 # 3D components (ambient scene, lazy loading)
│   │   ├── ui/                    # Shadcn UI components (button, card, dialog, etc.)
│   │   ├── notifications/         # Toast and notification UI
│   │   ├── watchlists/            # Watchlist management UI
│   │   ├── news/                  # News feed components
│   │   └── compare/               # Comparison view components
│   ├── lib/                       # Business logic and utilities
│   │   ├── agents/                # Agent execution and chat
│   │   │   ├── residents/         # Individual agent implementations
│   │   │   ├── auth.ts            # API key validation
│   │   │   ├── chat.ts            # Chat logic and streaming
│   │   │   ├── runtime.ts         # Agent execution scheduler
│   │   │   ├── registry.ts        # Agent registration and loading
│   │   │   └── types.ts           # Agent type definitions
│   │   ├── data-sources/          # External data ingestion
│   │   │   ├── adapters/          # Data source implementations (HF, Anthropic, etc.)
│   │   │   ├── orchestrator.ts    # Sync coordinator
│   │   │   ├── registry.ts        # Adapter registration
│   │   │   ├── model-matcher.ts   # Map external models to internal IDs
│   │   │   └── types.ts           # Sync type definitions
│   │   ├── marketplace/           # Marketplace business logic
│   │   │   ├── auctions/          # Auction logic
│   │   │   ├── delivery.ts        # File delivery and escrow
│   │   │   ├── enrich-listings.ts # Listing enhancement
│   │   │   └── escrow.ts          # Payment escrow handling
│   │   ├── payments/              # Payment processing
│   │   │   ├── chains/            # Blockchain chain integrations
│   │   │   └── wallet.ts          # Wallet balance and transactions
│   │   ├── scoring/               # Model quality and ranking
│   │   │   ├── quality-calculator.ts  # Quality score calculation
│   │   │   ├── market-cap-calculator.ts
│   │   │   └── agent-score-calculator.ts
│   │   ├── supabase/              # Database clients
│   │   │   ├── server.ts          # Server-side client (SSR safe)
│   │   │   ├── client.ts          # Browser client
│   │   │   └── admin.ts           # Service role client (admin operations)
│   │   ├── constants/             # Application constants
│   │   │   ├── categories.ts      # Model categories enum
│   │   │   ├── providers.ts       # Provider metadata and logos
│   │   │   ├── benchmarks.ts      # Benchmark definitions
│   │   │   ├── marketplace.ts     # Marketplace enums and constants
│   │   │   └── site.ts            # Site name, description, URL
│   │   ├── middleware/            # Request/response middleware
│   │   │   └── api-paywall.ts     # Payment and rate limiting gate
│   │   ├── utils/                 # Utilities
│   │   │   └── sanitize.ts        # XSS prevention
│   │   ├── mcp/                   # MCP (Model Context Protocol) server
│   │   ├── api-error.ts           # API error class
│   │   ├── env.ts                 # Environment validation
│   │   ├── format.ts              # Number/currency formatters
│   │   ├── logging.ts             # Logging utilities
│   │   ├── rate-limit.ts          # Rate limiting
│   │   ├── cron-tracker.ts        # Cron execution tracking
│   │   └── utils.ts               # General utilities
│   ├── hooks/                     # React custom hooks
│   │   └── use-debounce.ts        # Debounce value hook
│   ├── types/                     # TypeScript type definitions
│   │   └── database.ts            # Supabase table types (auto-generated)
│   └── public/                    # Static assets (served via Next.js)
│       ├── manifest.json          # PWA manifest
│       ├── icon-*.svg             # App icons
│       └── ...favicon files
├── .planning/                     # GSD documentation (this doc)
│   └── codebase/
├── docs/                          # Additional documentation
├── .github/                       # GitHub Actions workflows
├── node_modules/                  # Dependencies (not in git)
├── .next/                         # Next.js build output (not in git)
├── next.config.ts                 # Next.js configuration
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── components.json                # Shadcn component registry
├── .env.local                     # Local environment variables (not in git)
├── .env.example                   # Environment template
├── docker-compose.yml             # Supabase local dev setup
└── package.json                   # Dependencies and scripts
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router — defines all routes, pages, and API endpoints
- Contains: Route groups (parentheses), page.tsx files, layout.tsx, API handlers
- Key files: `src/app/layout.tsx` (root), `src/app/page.tsx` (homepage)

**`src/app/(catalog)/`:**
- Purpose: Public model discovery feature
- Contains: Model search, filtering, detail pages, comparisons
- Key: Uses dynamic routes like `[slug]` for individual model pages

**`src/app/(marketplace)/`:**
- Purpose: Marketplace for buying/selling model services and data
- Contains: Seller dashboards, listing management, order tracking
- Key: Authenticated routes requiring `is_seller` or `is_admin` roles

**`src/app/(admin)/`:**
- Purpose: Administrative interfaces for platform management
- Contains: Data source management, agent control, analytics, moderation
- Key: Restricted to users with `is_admin = true`

**`src/app/api/`:**
- Purpose: RESTful API endpoints (backend routes)
- Contains: CRUD handlers, cron job endpoints, webhook receivers
- Pattern: `route.ts` files handle GET/POST/PUT/DELETE per endpoint

**`src/components/`:**
- Purpose: Reusable UI components
- Organization: Grouped by feature or UI domain
- Patterns: Mix of Server Components and Client Components (marked with "use client")

**`src/lib/agents/`:**
- Purpose: Autonomous task scheduling and execution
- Examples: Weather bot, news crawler, market analyzer
- Key: `registry.ts` loads all agents; `runtime.ts` executes with timeout

**`src/lib/data-sources/`:**
- Purpose: External data integration pipeline
- Adapters: HuggingFace, Anthropic, HELM, other benchmark sources
- Flow: Orchestrator → Registry → Adapter → Supabase

**`src/lib/scoring/`:**
- Purpose: Calculate composite metrics for ranking and discovery
- Key calculators:
  - `quality-calculator.ts`: Overall model quality (0-100)
  - `market-cap-calculator.ts`: Estimated market cap
  - `agent-score-calculator.ts`: Agentic capability ranking

**`src/lib/marketplace/`:**
- Purpose: Marketplace transaction logic
- Key: Escrow management, delivery fulfillment, listing enrichment

**`src/lib/supabase/`:**
- Purpose: Centralized database client creation
- Pattern: Separate clients for server (SSR), browser (client-side), admin (service role)

**`src/types/`:**
- Purpose: TypeScript type definitions
- Key: `database.ts` mirrors Supabase schema and is auto-generated

## Key File Locations

**Entry Points:**
- Root layout: `src/app/layout.tsx`
- Homepage: `src/app/page.tsx`
- Auth context provider: `src/components/auth/auth-provider.tsx`
- PWA service worker: `src/components/pwa-register.tsx`

**Configuration:**
- TypeScript: `tsconfig.json` (path aliases `@/*` → `src/*`)
- Next.js: `next.config.ts`
- Tailwind: `tailwind.config.js`
- Environment: `.env.local` or `.env.example`

**Core Logic:**
- API error handling: `src/lib/api-error.ts`
- Rate limiting: `src/lib/rate-limit.ts`
- Paywall logic: `src/lib/middleware/api-paywall.ts`
- Scoring algorithms: `src/lib/scoring/`
- Data pipeline: `src/lib/data-sources/orchestrator.ts`

**Testing:**
- Not detected in current structure

**Database Queries:**
- All Supabase queries use clients from `src/lib/supabase/`
- Inline in pages and API routes
- No separate query layer or ORM

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx`
- Components: `PascalCase.tsx` (e.g., `AuthProvider`, `ModelCard`)
- Utilities: `kebab-case.ts` (e.g., `api-error.ts`, `rate-limit.ts`)
- Hooks: `use-*` prefix (e.g., `use-debounce.ts`, `useAuth()`)
- API routes: `route.ts` in dynamic segments (e.g., `api/models/[id]/route.ts`)

**Directories:**
- Feature folders: `kebab-case` (e.g., `data-sources`, `api-keys`)
- Component folders: `kebab-case` (e.g., `shared`, `three`)
- Route groups: Parentheses `(feature-name)` (Next.js convention)

**Functions:**
- Components: `PascalCase` (React conventions)
- Utility functions: `camelCase` (e.g., `createClient()`, `formatNumber()`)
- Event handlers: `handle*` prefix on client components (e.g., `handleSubmit()`)

**Variables:**
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `RATE_LIMITS`, `CACHE_TTL`)
- State: `camelCase` (e.g., `isLoading`, `formData`)
- Types: `PascalCase` interface/type names (e.g., `Model`, `BenchmarkScore`)

## Where to Add New Code

**New Feature (Catalog/Marketplace/Admin):**
1. Create route group in `src/app/(feature-name)/`
2. Add page and layout files (follow Next.js conventions)
3. Create components in `src/components/(feature-name)/`
4. Add API routes in `src/app/api/(feature-name)/`
5. Add business logic in `src/lib/(feature-name)/`
6. Add types to `src/types/database.ts`

**New Component/UI:**
- Location: `src/components/` (organize by feature)
- Pattern: Default export, PascalCase filename
- If reusable across features: `src/components/shared/`
- If from shadcn: Use `npx shadcn-ui@latest add [component]` to generate in `src/components/ui/`

**Utilities:**
- Shared helpers: `src/lib/utils/` or `src/lib/{feature-name}/`
- Formatters: `src/lib/format.ts`
- Error handling: `src/lib/api-error.ts`
- Constants: `src/lib/constants/`

**Data Pipeline (Sync/Cron):**
- Data source adapter: Create in `src/lib/data-sources/adapters/[source].ts`
- Register in `src/lib/data-sources/registry.ts`
- Orchestrator calls via `executeSync(tier)`
- Agent: Create in `src/lib/agents/residents/[agent-name].ts`
- Register in `src/lib/agents/registry.ts`

**API Endpoints:**
- Pattern: Create `src/app/api/[route]/route.ts`
- Use `createClient()` for Supabase (server-side)
- Use `createAdminClient()` for service-role operations
- Import `ApiError` and `handleApiError()` for consistency
- Add `export const dynamic = "force-dynamic"` if not cached

**Tests:**
- Not currently in use; establish pattern if needed
- Suggested: Co-locate `*.test.ts` or `*.spec.ts` next to implementation

## Special Directories

**`src/public/`:**
- Purpose: Static assets served by Next.js
- Generated: No
- Committed: Yes (versioned with code)
- Includes: Icons, PWA manifest, favicon

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (from `npm run build`)
- Committed: No (in `.gitignore`)

**`.planning/codebase/`:**
- Purpose: GSD codebase documentation
- Generated: No (manually created/updated)
- Committed: Yes

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (from `package.json` and `package-lock.json`)
- Committed: No (in `.gitignore`)

**`docs/`:**
- Purpose: Additional documentation (deployment, setup, etc.)
- Examples: `DEPLOYMENT_STRATEGY.md`, `CLOUDFLARE_SETUP.md`
- Committed: Yes

---

*Structure analysis: 2026-03-02*
