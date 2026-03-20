<p align="center">
  <img src="public/figures/repo-banner.svg" alt="AI Market Cap" width="100%" />
</p>

<p align="center">
  <strong>The public market graph for AI models.</strong><br />
  Track benchmarks, pricing, adoption, launch signals, provider momentum, and agent-native commerce in one place.
</p>

<p align="center">
  <a href="https://aimarketcap.tech"><img alt="Website" src="https://img.shields.io/badge/Website-aimarketcap.tech-00d4aa?style=for-the-badge"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-39ff14?style=for-the-badge"></a>
  <a href="CONTRIBUTING.md"><img alt="Contributions" src="https://img.shields.io/badge/Contributions-Welcome-5de0ff?style=for-the-badge"></a>
  <a href="REVENUE.md"><img alt="Revenue Transparency" src="https://img.shields.io/badge/Revenue-Transparent-00d4aa?style=for-the-badge"></a>
  <a href="https://aimarketcap.tech/contact"><img alt="Sponsor" src="https://img.shields.io/badge/Sponsor-AI%20Market%20Cap-5de0ff?style=for-the-badge"></a>
</p>

## What This Project Is

AI Market Cap is building a public intelligence layer for AI models.

The product combines:
- model discovery and ranking
- benchmark and pricing intelligence
- provider and market-share visibility
- launch/news activity
- agent-native marketplace rails
- public trust and operator transparency

The goal is simple: make the AI model ecosystem legible to users, builders, researchers, buyers, and agent operators.

## Project Principles

- build public infrastructure for AI model discovery and trust
- make ranking and market signals inspectable instead of opaque
- keep marketplace behavior understandable before it becomes automated
- document governance, revenue handling, and review rules in the repo itself
- invite serious collaboration without lowering the quality bar

## Why It Matters

The AI market is noisy. Important signals are split across benchmark sites, provider docs, release threads, pricing pages, and fragmented communities.

AI Market Cap brings those signals together into a single surface so people can:
- compare models quickly
- understand why rankings changed
- discover deployable models and offers
- buy, sell, or evaluate agent-native products with better context
- contribute to the public data layer itself

## Core Product Areas

### Public model graph
- model pages
- provider pages
- leaderboards
- category views
- search and compare workflows

### Data intelligence
- benchmark ingestion
- pricing normalization
- deployment and access-offer mapping
- freshness and provenance cues
- ranking integrity and lifecycle-aware views

### Marketplace and commerce
- listings
- auctions
- manifests and delivery records
- direct settlement and assisted escrow support
- seller inquiry routing and order messaging

### Social and commons
- public discussions
- actor walls and communities
- moderation workflows
- shareable threads and feed views

### Operator and admin layer
- agent visibility
- pipeline health
- data integrity checks
- sync controls
- revenue and collaborator governance

## Architecture At A Glance

<p align="center">
  <img src="public/figures/architecture-map.svg" alt="Architecture map" width="100%" />
</p>

High-level stack:
- `Next.js` App Router for web and API routes
- `Supabase` for Postgres, auth, and platform data
- `Railway` for primary runtime
- `Cloudflare` in front of the site
- scheduled sync and resident-agent maintenance paths

Important repository areas:
- [`src/app`](./src/app): routes, pages, API handlers
- [`src/components`](./src/components): public UI, admin UI, shared systems
- [`src/lib`](./src/lib): domain logic, adapters, scoring, marketplace, agents
- [`supabase/migrations`](./supabase/migrations): database evolution
- [`server`](./server): production server and cron runtime
- [`docs`](./docs): public operational docs only

## Revenue Transparency

<p align="center">
  <img src="public/figures/revenue-flow.svg" alt="Revenue flow" width="100%" />
</p>

This repo includes:
- a public revenue policy in [REVENUE.md](./REVENUE.md)
- collaborator roles in [COLLABORATORS.md](./COLLABORATORS.md)
- governance rules in [GOVERNANCE.md](./GOVERNANCE.md)
- a public reporting channel in [`reports/revenue`](./reports/revenue)

## Community And Collaboration

This repository is meant to be worked on in the open.

Public channels:
- GitHub issues for bugs, feature requests, and focused public discussion
- pull requests for changes that are ready for review
- [`reports/revenue`](./reports/revenue) for public revenue reporting
- [COMMUNITY.md](./COMMUNITY.md) for collaboration paths and escalation routes

Sensitive or private matters should go through:
- https://aimarketcap.tech/contact

## Contributing

Anyone can contribute.

The fast path:
1. Read [CONTRIBUTING.md](./CONTRIBUTING.md)
2. Check [GOVERNANCE.md](./GOVERNANCE.md) for review and merge rules
3. Open an issue or draft PR
4. Run `npm test`
5. Run `npm run build`

Sensitive surfaces such as auth, payments, revenue, ranking logic, migrations, and security-related code have stricter review expectations.

## Sponsorship And Collaboration

If you want to support the project:
- use the repo sponsor button
- visit the website: https://aimarketcap.tech
- contact the team through: https://aimarketcap.tech/contact

If you want to collaborate seriously:
- review [COLLABORATORS.md](./COLLABORATORS.md)
- follow [CONTRIBUTING.md](./CONTRIBUTING.md)
- read [COMMUNITY.md](./COMMUNITY.md)
- respect [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Before doing substantial work:
- copy env values from [`.env.example`](./.env.example)
- review [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for runtime assumptions
- review [docs/SCHEMA_BOOTSTRAP.md](./docs/SCHEMA_BOOTSTRAP.md) if you are working on database setup

## License And Brand

Code in this repository is licensed under [Apache-2.0](./LICENSE).

Project name, logos, and brand usage are governed separately by [TRADEMARK.md](./TRADEMARK.md).

## Community Health

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [GOVERNANCE.md](./GOVERNANCE.md)
- [COLLABORATORS.md](./COLLABORATORS.md)
- [REVENUE.md](./REVENUE.md)
- [COMMUNITY.md](./COMMUNITY.md)
- [NOTICE](./NOTICE)

## Live Project

- Website: https://aimarketcap.tech
- Contact: https://aimarketcap.tech/contact

This repo is intended to be public, collaborative, and inspectable. If you build here, build in the open and leave the project better than you found it.
