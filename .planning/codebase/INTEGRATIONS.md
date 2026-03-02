# External Integrations

**Analysis Date:** 2026-03-02

## APIs & External Services

**AI Model Providers:**
- OpenAI - Model metadata and chat completions
  - SDK/Client: Custom HTTP via fetch (not SDK dependency)
  - Auth: `OPENAI_API_KEY` (environment variable)
  - Adapter: `src/lib/data-sources/adapters/openai-models.ts`

- Anthropic - Claude model metadata
  - SDK/Client: `@anthropic-ai/sdk` (0.78.0)
  - Auth: `ANTHROPIC_API_KEY`
  - Adapter: `src/lib/data-sources/adapters/anthropic-models.ts`
  - Usage: Agent conversations, code quality analysis

- Google AI (Gemini) - Model metadata
  - SDK/Client: Custom HTTP
  - Auth: `GOOGLE_AI_API_KEY`
  - Adapter: `src/lib/data-sources/adapters/google-models.ts`

- Replicate - AI model deployment platform
  - SDK/Client: Custom HTTP
  - Auth: `REPLICATE_API_TOKEN`
  - Adapter: `src/lib/data-sources/adapters/replicate.ts`

- OpenRouter - Free model discovery API
  - SDK/Client: Custom HTTP
  - Auth: `OPENROUTER_API_KEY` (optional, rate-limited without)
  - Adapter: `src/lib/data-sources/adapters/openrouter-models.ts`

**ML/AI Benchmarking & Data:**
- HuggingFace - Model hub, papers, leaderboards
  - SDK/Client: Custom HTTP
  - Auth: `HUGGINGFACE_API_TOKEN` (optional)
  - Adapters: `huggingface.ts`, `hf-papers.ts`

- CivitAI - Community AI models
  - SDK/Client: Custom HTTP
  - Auth: `CIVITAI_API_KEY` (optional)
  - Adapter: `src/lib/data-sources/adapters/civitai.ts`

- Artificial Analysis - AI benchmarking data
  - SDK/Client: Custom HTTP
  - Auth: `ARTIFICIAL_ANALYSIS_API_KEY` (optional)
  - Adapter: `src/lib/data-sources/adapters/artificial-analysis.ts`

- Multiple Leaderboards (Open LLM, Chatbot Arena, LiveBench, SEAL, etc.)
  - SDK/Client: Custom HTTP (public endpoints, no auth required)
  - Adapters in: `src/lib/data-sources/adapters/`
    - `open-llm-leaderboard.ts`
    - `chatbot-arena.ts`
    - `livebench.ts`
    - `seal-leaderboard.ts`
    - `bigcode-leaderboard.ts`
    - `open-vlm-leaderboard.ts`

**Social & News:**
- X/Twitter (via RSSHub) - Social feed aggregation
  - Service: RSSHub (local Docker container)
  - Configuration: `RSSHUB_BASE_URL` (defaults to `http://localhost:1200`)
  - Auth: `TWITTER_COOKIE` (X auth cookie for RSSHub)
  - Usage: Aggregates X announcements for AI providers
  - Adapter: `src/lib/data-sources/adapters/x-announcements.ts`

- GitHub - Code repository data, trending projects
  - SDK/Client: `octokit` (5.0.5)
  - Auth: `GITHUB_TOKEN` (personal access token, optional)
  - Adapters: `github-trending.ts`, `github-stars.ts`
  - Resident Agent: Code quality monitor creates GitHub issues

- arXiv - Research papers (public API)
  - SDK/Client: Custom HTTP (no auth required)
  - Adapter: `src/lib/data-sources/adapters/arxiv.ts`

**News & Provider Information:**
- Provider pricing data, news, documentation
  - SDK/Client: Custom HTTP scraping/parsing
  - Adapters: `provider-news.ts`, `provider-pricing.ts`, `deployment-pricing.ts`

## Data Storage

**Databases:**
- Supabase (PostgreSQL backend)
  - URL: `NEXT_PUBLIC_SUPABASE_URL`
  - Anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, browser-safe)
  - Service role key: `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS)
  - Client libraries: `@supabase/supabase-js`, `@supabase/ssr`
  - Auth: Managed by Supabase (JWT tokens, email/password)
  - RLS: Row-Level Security policies enforce data isolation

**Database Schema Highlights:**
- Users & Auth: Handled by Supabase auth
- Profiles: User data with `is_admin` flag
- Models: AI model registry with metadata, benchmarks, scoring
- Listings: Marketplace listings for model access
- Orders: Purchase orders with escrow and delivery tracking
- Wallets: Multi-chain wallets (Solana, Base, Polygon)
- Wallet Transactions: Deposit/withdrawal history
- Agent Conversations: Bot-to-bot and user-to-bot chat
- Agent Logs: Task execution logs for monitoring
- Data Sources: Registry of sync adapters
- Webhooks: Chain deposit notifications

**File Storage:**
- Not detected - Application appears to be data-only (no file uploads)

**Caching:**
- Not detected - No Redis or dedicated cache layer
- Lightweight-Charts and Recharts: In-browser chart rendering
- Static asset caching via HTTP headers (31536000s for images)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Custom implementation
  - Method: Email/password with JWT tokens
  - Session: Stored in HTTP-only cookies (managed by Supabase SSR)
  - Middleware: `src/middleware.ts` enforces auth for protected routes
  - Protected Routes: `/profile`, `/sell`, `/watchlists`, `/activity`, `/settings/*`, `/dashboard/*`, `/orders/*`, `/admin/*`
  - Admin check: Middleware verifies `profiles.is_admin` flag on admin routes

**Session Management:**
- Server-side: `src/lib/supabase/server.ts` uses `@supabase/ssr` for cookie handling
- Client-side: `src/lib/supabase/client.ts` uses browser client for authenticated requests
- Admin operations: `src/lib/supabase/admin.ts` uses service role key (server-only)

## Monitoring & Observability

**Error Tracking:**
- Database logging: `agent_logs` table stores errors with metadata
- Code Quality Agent: `src/lib/agents/residents/code-quality.ts` analyzes error patterns
- Creates GitHub issues automatically for recurring errors

**Logs:**
- Application logs: Printed to stdout (standard Next.js logging)
- Agent logs: Stored in `agent_logs` table via `src/lib/logging.ts`
- Cron tracker: `src/lib/cron-tracker.ts` monitors scheduled job execution

**Metrics:**
- Cron execution tracking (success/failure, duration)
- Model scoring computed every 6 hours
- Agent task completion and error patterns

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from Next.js deployment pattern)
- Deployed from main branch

**CI Pipeline:**
- GitHub Actions - Scheduled cron jobs via `.github/workflows/cron-sync.yml`
- Cron jobs are HTTP triggers to Next.js API routes, not job runners
- Job types:
  - Tier-based data syncs (every 6h, 12h, daily, weekly)
  - Model scoring (every 6 hours)
  - Agent pipeline (every 6 hours)
  - Code quality monitoring (daily)
  - UX monitoring (weekly)

**Cron Authentication:**
- Authorization via `CRON_SECRET` bearer token
- Validated in API routes via `src/lib/middleware/cron-auth.ts` (inferred)

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only)
- `CRON_SECRET` - Authentication token for cron jobs

**Optional data source adapters:**
- `REPLICATE_API_TOKEN` - Replicate API key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_AI_API_KEY` - Google AI API key
- `HUGGINGFACE_API_TOKEN` - HuggingFace API token
- `CIVITAI_API_KEY` - CivitAI API key
- `ARTIFICIAL_ANALYSIS_API_KEY` - Artificial Analysis API key
- `OPENROUTER_API_KEY` - OpenRouter API key

**Optional integrations:**
- `STRIPE_SECRET_KEY` - Stripe secret (marketplace payments)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `GITHUB_TOKEN` - GitHub personal access token (code quality agent)
- `SOLANA_RPC_URL` - Solana blockchain RPC endpoint
- `SOLANA_MASTER_PRIVATE_KEY` - Solana wallet private key for withdrawals
- `EVM_MASTER_PRIVATE_KEY` - EVM wallet private key (Base/Polygon)
- `BASE_RPC_URL` - Base chain RPC endpoint
- `POLYGON_RPC_URL` - Polygon chain RPC endpoint
- `RSSHUB_BASE_URL` - RSSHub service URL (defaults to `http://localhost:1200`)
- `TWITTER_COOKIE` - X auth cookie for RSSHub

**Site Configuration:**
- `NEXT_PUBLIC_SITE_URL` - Public site URL for SEO/OG tags (defaults to `https://aimarketcap.com`)

**Secrets location:**
- Development: `.env.local` (git-ignored)
- Production: Vercel environment variables (GitHub Secrets integration)
- Example template: `.env.example`

## Webhooks & Callbacks

**Incoming:**
- Chain deposits: `src/app/api/webhooks/chain-deposits/route.ts`
  - Listens for Solana/EVM blockchain deposit confirmations
  - Updates wallet balances when deposits detected
  - Supports both Solana SPL tokens and EVM ERC20 tokens

- Stripe webhooks (optional if payments enabled)
  - Not yet detected in current codebase—likely in `src/app/api/webhooks/stripe/*` (may be under development)

**Outgoing:**
- GitHub issue creation: Code quality agent creates issues for recurring errors
- No outgoing webhooks detected for external services

## Data Source Adapter Architecture

**Location:** `src/lib/data-sources/`

**Components:**
- `orchestrator.ts` - Manages data sync lifecycle (queues, executes adapters)
- `registry.ts` - Factory pattern for adapter registration and lookup
- `adapters/` - Individual adapter implementations (27+ adapters)
- `types.ts` - Shared interfaces for adapters

**Adapter Pattern:**
```typescript
// Example adapter structure
export const myAdapter: DataSourceAdapter = {
  id: "source-id",
  name: "Source Name",
  async fetch(ctx) {
    // Fetch data from external API
    // Return normalized results
  },
  async sync(ctx, data) {
    // Upsert data into Supabase
  }
}
```

**Sync Tiers:**
- Tier 1 (every 6h): Core model metadata (OpenAI, Anthropic, Google, Replicate)
- Tier 2 (every 12h): Benchmarks and leaderboards
- Tier 3 (daily): News, papers, social feeds
- Tier 4 (weekly): GitHub stars, pricing data

---

*Integration audit: 2026-03-02*
