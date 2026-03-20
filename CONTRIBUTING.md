# Contributing To AI Market Cap

Thanks for contributing.

This repository is public because we want strong external collaboration, not because we want low-signal noise. Read this file before opening a PR.

## What good contributions look like

- they improve the product, data quality, trust, performance, or maintainability
- they are scoped and reviewable
- they come with verification
- they preserve the public quality bar of the project

## Before you open a PR

1. Read [GOVERNANCE.md](./GOVERNANCE.md)
2. Check whether an issue already exists
3. Keep one PR focused on one change
4. Run:

```bash
npm test
npm run build
```

5. Include screenshots or recordings for public UI changes
6. Include migration notes for schema changes
7. Include risk notes for auth, ranking, payments, marketplace, or cron changes

## Setup

```bash
npm install
npm run dev
```

Review:
- [`.env.example`](./.env.example)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/SCHEMA_BOOTSTRAP.md](./docs/SCHEMA_BOOTSTRAP.md)

## PR categories

### Good first contributions
- copy and documentation improvements
- figure and README polish
- non-sensitive component tests
- accessibility and layout fixes
- performance fixes with clear verification

### Sensitive areas

Changes touching the following get stricter review:
- auth
- payments and wallets
- revenue logic
- ranking/scoring methodology
- marketplace purchase or settlement paths
- Supabase migrations and RLS
- cron and operational automation
- security headers, secrets, or admin surfaces

## Pull request checklist

Every PR should include:
- clear summary
- why the change exists
- screenshots for visible UX changes
- test/build verification notes
- docs updates if public behavior changed

## Review expectations

- standard UI/docs/test improvements: at least 1 maintainer review
- sensitive logic: maintainer review plus additional scrutiny under [GOVERNANCE.md](./GOVERNANCE.md)
- maintainers may request narrower scope before merge

## What not to do

- do not bundle unrelated changes
- do not rewrite project identity or methodology casually
- do not add hidden tracking, ads, or opaque monetization logic
- do not weaken transparency, attribution, or public trust surfaces

## Communication

If your change is large:
- open an issue first
- explain your intended direction
- align on scope before building

For conduct expectations, read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

For where to ask, discuss, escalate, or collaborate publicly, read [COMMUNITY.md](./COMMUNITY.md).
