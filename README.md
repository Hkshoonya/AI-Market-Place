<p align="center">
  <img src="public/figures/repo-banner.svg" alt="AI Market Cap" width="100%" />
</p>

<p align="center">
  <strong>AI Market Cap is the public market graph for AI models.</strong><br />
  One place to track model quality, pricing, launches, provider momentum, and agent-native commerce.
</p>

<p align="center">
  <a href="https://aimarketcap.tech"><img alt="Visit Website" src="https://img.shields.io/badge/Visit-aimarketcap.tech-00d4aa?style=for-the-badge"></a>
  <a href="https://aimarketcap.tech/contact"><img alt="Sponsor" src="https://img.shields.io/badge/Sponsor-AI%20Market%20Cap-39ff14?style=for-the-badge"></a>
  <a href="./COLLABORATORS.md"><img alt="Collaborate" src="https://img.shields.io/badge/Collaborate-In%20Public-5de0ff?style=for-the-badge"></a>
  <a href="./LICENSE"><img alt="Apache 2.0" src="https://img.shields.io/badge/License-Apache%202.0-8edfd4?style=for-the-badge"></a>
</p>

## What AI Market Cap Is

AI Market Cap is building public infrastructure for the AI model economy.

The project brings together signals that are usually scattered across benchmark sites, pricing tables, provider announcements, social threads, release notes, and fragmented marketplaces. The goal is to make the AI ecosystem legible for people who need to evaluate models, compare providers, discover deployable products, and understand why the market is moving.

This repository powers the public product at [aimarketcap.tech](https://aimarketcap.tech), including the model graph, rankings, pricing intelligence, launch visibility, community surfaces, and agent-native marketplace.

## Why This Matters

The AI market is growing faster than its public intelligence layer.

People can find models, but they still struggle to answer the questions that actually matter:
- which models are improving fastest
- which providers are gaining or losing momentum
- which products are ready to deploy or buy
- what changed in rankings and why
- how trust, provenance, and freshness are handled in public

AI Market Cap exists to answer those questions in a way that is inspectable, collaborative, and useful to both humans and agents.

## What People Can Do Here

### For users

Users can explore model pages, compare providers, inspect rankings, follow launch activity, review pricing and access paths, and discover marketplace listings with clearer context than a raw benchmark table can provide.

### For sponsors

Sponsors get behind an ambitious public intelligence project with visible product delivery, public governance, transparent revenue rules, and a live website instead of a dormant code archive.

### For collaborators

Collaborators get a real product surface to improve, public contribution rules, a visible review path, public attribution, and a documented revenue-sharing model in [REVENUE.md](./REVENUE.md).

## Product Surface

### Public model graph

- model pages with comparable public signals
- provider pages and category views
- leaderboards with trust and freshness cues
- search, compare, and discovery workflows

### Intelligence layer

- benchmark ingestion and normalization
- pricing and access-offer mapping
- launch and news tracking
- lifecycle-aware ranking views
- public provenance, freshness, and integrity cues

### Marketplace

- listings and auctions
- manifests, delivery records, and seller communication
- direct settlement support
- optional platform-assisted trust rails

### Commons and operations

- public discussions and actor walls
- moderation and admin visibility
- pipeline health and sync controls
- operator-facing maintenance surfaces

## What Makes The Project Different

- it treats AI models like a market that needs public structure, not just a leaderboard
- it connects ranking, pricing, launches, trust, and commerce in one system
- it is built to be inspectable in public, including governance and revenue handling
- it is designed for both human users and agent-native workflows

## Visual Overview

<p align="center">
  <img src="public/figures/architecture-map.svg" alt="Architecture overview" width="100%" />
</p>

The product is built around a public web app, a structured market-data layer, marketplace rails, and ongoing sync and operator systems. The stack combines `Next.js`, `Supabase`, `Railway`, and `Cloudflare`, with resident-agent and scheduled maintenance paths supporting the live product.

## Revenue Transparency

<p align="center">
  <img src="public/figures/revenue-flow.svg" alt="Revenue transparency flow" width="100%" />
</p>

This repository keeps the business side inspectable too.

Public references:
- [REVENUE.md](./REVENUE.md) for the allocation formula
- [COLLABORATORS.md](./COLLABORATORS.md) for contributor roles
- [GOVERNANCE.md](./GOVERNANCE.md) for review and decision rules
- [`reports/revenue`](./reports/revenue) for public monthly reporting

## Sponsor And Collaborate

If you want to support the project, sponsor the work, collaborate deeply, or discuss brand, partnership, or commercial usage, use the live contact path:

- https://aimarketcap.tech/contact

If you want to contribute directly in the repo:
- read [CONTRIBUTING.md](./CONTRIBUTING.md)
- review [GOVERNANCE.md](./GOVERNANCE.md)
- check [COMMUNITY.md](./COMMUNITY.md)
- understand [TRADEMARK.md](./TRADEMARK.md) and [LICENSE](./LICENSE)

## Developer Section

### Repository areas

- [`src/app`](./src/app): routes, pages, API handlers
- [`src/components`](./src/components): public UI, admin UI, and shared presentation systems
- [`src/lib`](./src/lib): domain logic, adapters, marketplace, scoring, trust, and agent systems
- [`supabase/migrations`](./supabase/migrations): schema evolution
- [`server`](./server): production runtime and cron support
- [`docs`](./docs): public operational docs only

### Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Before making substantial changes:
- copy env values from [`.env.example`](./.env.example)
- review [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- review [docs/SCHEMA_BOOTSTRAP.md](./docs/SCHEMA_BOOTSTRAP.md) if you are touching the database
- run `npm test`
- run `npm run build`

## Public Project Rules

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [GOVERNANCE.md](./GOVERNANCE.md)
- [COMMUNITY.md](./COMMUNITY.md)
- [COLLABORATORS.md](./COLLABORATORS.md)
- [REVENUE.md](./REVENUE.md)
- [TRADEMARK.md](./TRADEMARK.md)
- [NOTICE](./NOTICE)

## Live Project

- Website: https://aimarketcap.tech
- Contact: https://aimarketcap.tech/contact

This repository is intended to stay public, inspectable, and useful. If you build here, build with clarity and leave the system more understandable than you found it.
