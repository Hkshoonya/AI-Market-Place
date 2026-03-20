<p align="center">
  <img src="public/figures/repo-banner.svg" alt="AI Market Cap — The Public Market Graph for AI Models" width="100%" />
</p>

<p align="center">
  <a href="https://aimarketcap.tech"><img alt="Live" src="https://img.shields.io/badge/Live-aimarketcap.tech-00D4AA?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0id2hpdGUiIHZpZXdCb3g9IjAgMCAxNiAxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjQiLz48L3N2Zz4="></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-8edfd4?style=for-the-badge"></a>
  <a href="./CONTRIBUTING.md"><img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-Welcome-39FF14?style=for-the-badge"></a>
  <a href="https://aimarketcap.tech/contact"><img alt="Sponsor" src="https://img.shields.io/badge/Sponsor-This%20Project-8B5CF6?style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://github.com/Hkshoonya/AI-Market-Place/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Hkshoonya/AI-Market-Place/ci.yml?branch=main&style=flat-square&label=CI&logo=github"></a>
  <a href="https://github.com/Hkshoonya/AI-Market-Place"><img alt="Stars" src="https://img.shields.io/github/stars/Hkshoonya/AI-Market-Place?style=flat-square&color=00D4AA"></a>
  <a href="https://github.com/Hkshoonya/AI-Market-Place/issues"><img alt="Issues" src="https://img.shields.io/github/issues/Hkshoonya/AI-Market-Place?style=flat-square&color=39FF14"></a>
  <a href="https://github.com/Hkshoonya/AI-Market-Place/pulls"><img alt="PRs" src="https://img.shields.io/github/issues-pr/Hkshoonya/AI-Market-Place?style=flat-square&color=8B5CF6"></a>
</p>

---

**AI Market Cap** is public infrastructure for the AI model economy. It brings together rankings, benchmarks, pricing, launches, provider momentum, trust signals, and agent-native commerce into one inspectable system.

The AI market is growing faster than its public intelligence layer. People can find models, but they still can't easily answer the questions that matter:

- Which models are improving fastest?
- Which providers are gaining or losing momentum?
- Which products are ready to deploy or buy?
- What changed in the rankings — and why?
- How are trust, provenance, and freshness handled?

**AI Market Cap exists to answer those questions** — in a way that is inspectable, collaborative, and useful to both humans and agents.

<br>

## What You Can Do Here

<table>
<tr>
<td width="50%">

### For Users
Explore model pages, compare providers, inspect rankings, follow launch activity, review pricing and access paths, and discover marketplace listings — all with more context than a raw benchmark table.

</td>
<td width="50%">

### For Developers
A real product surface to improve. Public contribution rules, visible review paths, clear architecture, and a documented [revenue-sharing model](./REVENUE.md) for collaborators.

</td>
</tr>
<tr>
<td width="50%">

### For Sponsors
Back an ambitious public intelligence project with visible product delivery, transparent governance, public revenue handling, and a live website — not a dormant code archive.

</td>
<td width="50%">

### For Agents
Agent-native workflows, structured data, MCP integration, and commerce rails designed for programmatic access alongside human users.

</td>
</tr>
</table>

<br>

## Product Surface

```
                            AI MARKET CAP
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │   MODEL GRAPH          INTELLIGENCE       MARKETPLACE   │
    │   ─────────            ────────────       ───────────   │
    │   Model pages          Benchmarks         Listings      │
    │   Leaderboards         Pricing maps       Auctions      │
    │   Provider views       Launch tracker     Settlement    │
    │   Compare tools        Trust signals      Delivery      │
    │   Category browse      Freshness cues     Trust rails   │
    │   Search + discover    News ingestion     Guest checkout│
    │                                                         │
    │   COMMONS              OPERATIONS         GOVERNANCE    │
    │   ───────              ──────────         ──────────    │
    │   Public discussions   Pipeline health    Revenue rules │
    │   Actor walls          Sync controls      Review policy │
    │   Social feeds         Cron scheduler     Contribution  │
    │   Notifications        Admin dashboards   points + pay  │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

<br>

## Architecture

<p align="center">
  <img src="public/figures/architecture-map.svg" alt="System Architecture — from presentation layer through intelligence and data to public governance" width="100%" />
</p>

<details>
<summary><strong>Tech Stack</strong></summary>
<br>

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 + React 19 | App router, SSR, API routes |
| **Language** | TypeScript | End-to-end type safety |
| **Database** | Supabase (Postgres) | Auth, RLS, real-time, 50+ migrations |
| **Hosting** | Railway | Container runtime, cron scheduler |
| **CDN** | Cloudflare | Edge caching, DDoS protection |
| **Payments** | Stripe | Fiat marketplace payments |
| **Blockchain** | Solana, Base, Polygon | Crypto settlement rails |
| **Visualization** | Three.js, Recharts | 3D scenes, data charts |
| **Testing** | Vitest + Playwright | Unit + E2E test suites |
| **Monitoring** | Sentry | Error tracking, performance |
| **CI/CD** | GitHub Actions | Lint, typecheck, test, E2E |

</details>

<br>

## Revenue Transparency

<p align="center">
  <img src="public/figures/revenue-flow.svg" alt="Revenue Transparency — from gross revenue through deductions to 50/25/25 allocation" width="100%" />
</p>

This project keeps the business side inspectable. Revenue is measured, reduced to net, allocated by public policy, and reported in the repo.

| Document | What It Covers |
|----------|---------------|
| [REVENUE.md](./REVENUE.md) | Allocation formula, contributor points, eligibility rules |
| [COLLABORATORS.md](./COLLABORATORS.md) | Roles, expectations, how to become a collaborator |
| [GOVERNANCE.md](./GOVERNANCE.md) | Review rules, decision style, accountability |
| [`reports/revenue/`](./reports/revenue) | Public monthly reporting ledger |

<br>

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Hkshoonya/AI-Market-Place.git
cd AI-Market-Place

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase credentials (see .env.example for all options)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Before making substantial changes, review:
- [`.env.example`](./.env.example) — all environment variables documented
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — production architecture
- [`docs/SCHEMA_BOOTSTRAP.md`](./docs/SCHEMA_BOOTSTRAP.md) — database setup

<br>

## Repository Map

```
src/
├── app/                    # Next.js app router — pages, API routes, layouts
│   ├── (catalog)/          #   Model catalog and detail pages
│   ├── (marketplace)/      #   Marketplace listings and commerce
│   ├── (rankings)/         #   Leaderboards and ranking views
│   ├── api/                #   REST API endpoints
│   └── commons/            #   Community and social features
├── components/             # React components organized by domain
│   ├── charts/             #   Data visualization (Recharts)
│   ├── marketplace/        #   Commerce UI
│   ├── models/             #   Model display and comparison
│   ├── three/              #   3D scenes (Three.js)
│   └── ui/                 #   Base design system components
├── lib/                    # Core business logic
│   ├── agents/             #   LLM-backed analysis agents
│   ├── data-sources/       #   External API adapters
│   ├── marketplace/        #   Commerce and settlement logic
│   ├── payments/           #   Stripe + crypto payment flows
│   ├── scoring/            #   Ranking and trust algorithms
│   └── pipeline/           #   Data sync orchestration
├── hooks/                  # Custom React hooks
└── types/                  # TypeScript type definitions

supabase/
├── migrations/             # 50+ database migrations (schema evolution)
└── functions/              # Edge functions (HuggingFace sync, etc.)

server/                     # Custom Node.js server + cron support
docs/                       # Deployment and schema documentation
e2e/                        # Playwright end-to-end tests
```

<br>

## Contributing

We want strong collaboration, not noise. Read these before opening a PR:

1. **[CONTRIBUTING.md](./CONTRIBUTING.md)** — PR guidelines, sensitive areas, review expectations
2. **[GOVERNANCE.md](./GOVERNANCE.md)** — Review rules, merge policy, decision style
3. **[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)** — Expected behavior and enforcement

### Good First Contributions

- Copy and documentation improvements
- Component tests for non-sensitive surfaces
- Accessibility and layout fixes
- Performance improvements with clear verification
- README and figure polish

### Verification Required

```bash
npm test          # Unit tests
npm run build     # Production build
npm run lint      # Code quality
```

<br>

## Sponsor This Project

AI Market Cap is built in public with transparent governance and revenue handling. Sponsoring means backing a live product with visible delivery — not a dormant repository.

**What sponsors get:**
- Visible alignment with public AI infrastructure
- Public acknowledgment in the project
- Direct communication channel for feedback and priorities
- Supporting open, inspectable AI market intelligence

**Reach out:** [aimarketcap.tech/contact](https://aimarketcap.tech/contact)

<br>

## Project Rules

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [GOVERNANCE.md](./GOVERNANCE.md) | Review and decision rules |
| [REVENUE.md](./REVENUE.md) | Revenue allocation and transparency |
| [COLLABORATORS.md](./COLLABORATORS.md) | Roles and eligibility |
| [COMMUNITY.md](./COMMUNITY.md) | Channels and working rules |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Behavior expectations |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting |
| [TRADEMARK.md](./TRADEMARK.md) | Brand and attribution policy |
| [LICENSE](./LICENSE) | Apache 2.0 |
| [NOTICE](./NOTICE) | Copyright notice |

<br>

---

<p align="center">
  <strong><a href="https://aimarketcap.tech">aimarketcap.tech</a></strong><br>
  <sub>Product first. Public by default. Built to make the AI model economy legible.</sub>
</p>

<p align="center">
  <sub>
    <a href="https://aimarketcap.tech/contact">Contact</a> ·
    <a href="./CONTRIBUTING.md">Contribute</a> ·
    <a href="./REVENUE.md">Revenue</a> ·
    <a href="./GOVERNANCE.md">Governance</a>
  </sub>
</p>
