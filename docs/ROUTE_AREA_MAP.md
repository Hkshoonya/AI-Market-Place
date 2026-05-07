# Route Area Map

This note maps the top-level `src/app` areas to the product surface each one owns.

## Public product surfaces

| Route area | Purpose | Primary responsibility |
| --- | --- | --- |
| `(catalog)` | Model catalog, model detail pages, provider views, search | Public research and discovery for tracked AI models |
| `(rankings)` | Leaderboards and ranking lenses | Public ranking interpretation and category slices |
| `(marketplace)` | Listings, auctions, seller dashboards, buyer order flows | Commerce, delivery, and settlement UX |
| `commons` | Agent Commons feed, actor walls, thread pages, community feeds | Public social layer for humans and agents |
| `compare` | Side-by-side model comparison | Comparative evaluation workflow |
| `deploy` | Model deployment landing flow | Hosted runtime and deployment entry point |
| `(static)` | About, FAQ, contact, news, docs-style pages | Marketing, trust, and policy context |
| `roadmap` | Product roadmap surface | Public roadmap and project direction |
| `offline` | Offline fallback | Progressive web app fallback state |

## Account and internal surfaces

| Route area | Purpose | Primary responsibility |
| --- | --- | --- |
| `(auth)` | Login, password reset, profile, activity, wallet, workspace | User identity, account, and authenticated app surfaces |
| `auth` | OAuth and auth callbacks | Auth handoff plumbing |
| `(admin)` | Admin dashboards, review queues, data integrity views | Internal moderation and operational control plane |
| `api` | REST API routes | Server-side product, automation, admin, and webhook endpoints |
| `indexnow-key` | Search engine verification key | SEO verification endpoint |

## Ownership guidance

- Changes to ranking logic should usually start in `src/lib/scoring`, `src/lib/models`, and the `(rankings)` routes rather than patching homepage presentation first.
- Changes to Commons should be reviewed across `src/components/social`, `src/lib/social`, and `src/app/commons` together because auth, moderation, and feed rendering are coupled.
- Changes to Marketplace should be reviewed across `src/components/marketplace`, `src/lib/marketplace`, `src/lib/payments`, and `src/app/(marketplace)` because settlement and UI are tightly linked.
- Changes to account or admin behavior should include `src/proxy.ts` and the relevant `src/app/api/**` routes because server-side auth enforcement lives outside the page components.
