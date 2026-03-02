# Technology Stack

**Analysis Date:** 2026-03-02

## Languages

**Primary:**
- TypeScript 5 - All source code (`.ts`, `.tsx` files)
- JavaScript (via TypeScript) - Runtime execution

**Secondary:**
- CSS (Tailwind) - Styling
- SQL - Supabase database queries

## Runtime

**Environment:**
- Node.js - Required (see `.nvmrc` for pinned version)
- Next.js 16.1.6 - Full-stack framework (API routes + frontend)

**Package Manager:**
- npm - Version management
- Lockfile: `package-lock.json` (present, committed)

## Frameworks

**Core:**
- Next.js 16.1.6 - React SSR/SSG, API routes, middleware
- React 19.2.3 - UI components and state
- React DOM 19.2.3 - DOM rendering

**UI Components & Styling:**
- Tailwind CSS 4.0.7 - Utility-first CSS framework
- shadcn/ui 3.8.5 - Prebuilt component library
- Radix UI 1.4.3 - Unstyled component primitives
- @radix-ui/react-popover 1.1.15 - Popover component
- Lucide React 0.575.0 - Icon library
- class-variance-authority 0.7.1 - Type-safe class composition
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.5.0 - Merge Tailwind classes intelligently

**Data & Visualization:**
- @tanstack/react-table 8.21.3 - Headless table component
- recharts 3.7.0 - Chart/graph visualization
- lightweight-charts 5.1.0 - Financial charting library

**Blockchain & Crypto:**
- @solana/web3.js 1.98.4 - Solana blockchain interaction
- viem 2.46.3 - Ethereum/EVM chain abstraction
- bs58 6.0.0 - Base58 encoding/decoding for Solana keys

**3D Graphics:**
- three 0.183.1 - 3D graphics engine
- @react-three/fiber 9.5.0 - React renderer for Three.js
- @react-three/drei 10.7.7 - Useful helpers for Three.js

**Notifications & UX:**
- sonner 2.0.7 - Toast notification library
- date-fns 4.1.0 - Date utility functions

**Database & Backend:**
- @supabase/supabase-js 2.98.0 - Supabase client SDK
- @supabase/ssr 0.8.0 - Server-side rendering utilities for Supabase
- zod 4.3.6 - Schema validation library

**AI & Agents:**
- @anthropic-ai/sdk 0.78.0 - Anthropic Claude API client
- octokit 5.0.5 - GitHub API client

**Testing & Dev:**
- eslint 9 - JavaScript linting
- eslint-config-next 16.1.6 - Next.js ESLint configuration
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions
- @types/three 0.183.1 - Three.js type definitions
- tsx 4.21.0 - TypeScript executor for scripts
- dotenv 17.3.1 - Environment variable loading
- tw-animate-css 1.4.0 - Tailwind animation utilities

## Key Dependencies

**Critical Infrastructure:**
- @supabase/supabase-js (2.98.0) - Primary database and auth system. Provides PostgreSQL access, JWT auth, RLS, and real-time subscriptions. Service role key required for admin operations.
- @anthropic-ai/sdk (0.78.0) - Claude API integration for agent conversations and code quality analysis. Used in resident agents for autonomous monitoring.

**AI Model Integration:**
- octokit (5.0.5) - GitHub API for code quality agent to create issues and analyze code patterns

**Blockchain:**
- @solana/web3.js (1.98.4) - Solana wallet generation, deposit detection, withdrawal execution
- viem (2.46.3) - Base and Polygon (EVM) chain interactions for USDC transfers

**External Data Sources:**
- None directly as dependencies—API keys for external services configured via environment variables
  - OpenAI, Anthropic, Google AI, Replicate, HuggingFace, CivitAI, Artificial Analysis
  - These are called via HTTP clients (fetch) in data source adapters

## Configuration

**Environment:**
- Configuration via `.env.local` (local development)
- Environment variables validated at startup via `src/lib/env.ts`
- Critical vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`

**Build:**
- `tsconfig.json` - TypeScript compiler configuration
  - Target: ES2017
  - Module resolution: bundler
  - Path alias: `@/*` → `./src/*`
  - Strict mode enabled
- `next.config.ts` - Next.js configuration
  - Remote image domains: `logo.clearbit.com`, `*.supabase.co`
  - Security headers configured (X-Frame-Options, CSP, etc.)
  - Service worker caching rules
  - Static asset caching (31536000s max-age)
- `postcss.config.mjs` - PostCSS/Tailwind configuration
- `eslint.config.mjs` - ESLint rules and Next.js overrides
- `components.json` - shadcn/ui component configuration

**Database:**
- Supabase PostgreSQL with Row-Level Security (RLS)
- TypeScript types auto-generated from schema (`src/types/database.ts`)
- Migrations managed in `supabase` directory (excluded from TypeScript)

## Platform Requirements

**Development:**
- Node.js LTS (pinned version in `.nvmrc` if present)
- PostgreSQL client library (via @supabase/supabase-js)
- For crypto features: Solana RPC endpoint, EVM RPC endpoints (Base, Polygon)

**Production:**
- Deployment target: Vercel (inferred from Next.js usage and GitHub Actions cron integration)
- Environment secrets injected at deploy time
- Cron jobs via GitHub Actions (see `.github/workflows/cron-sync.yml`)
- Optional: Docker support for local development (see `docker-compose.yml`)

## Optional Services (Configuration-Dependent)

**Data Ingestion:**
- Replicate API - AI model deployments
- OpenAI API - Model metadata
- Anthropic API - Claude model metadata
- Google AI API - Gemini metadata
- HuggingFace API - Model hub and papers
- CivitAI API - Community AI models
- Artificial Analysis - Benchmarking data
- OpenRouter API - Free model discovery

**Payments:**
- Stripe (optional) - Marketplace payment processing
  - Uses: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

**Blockchain/Crypto:**
- Solana RPC - Blockchain interaction (mainnet or testnet)
- Base RPC - EVM chain for USDC transfers
- Polygon RPC - EVM chain for USDC transfers

**Social & Feeds:**
- RSSHub - X/Twitter feed aggregation (runs locally in docker-compose)
- GitHub API - Code quality monitoring, issue creation

---

*Stack analysis: 2026-03-02*
