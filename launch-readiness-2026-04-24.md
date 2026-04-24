# Launch Readiness Assessment

Date: 2026-04-24

Verdict: Not yet verified for secure public launch

The site is operational and the data pipeline is healthy, but the current production build still has unresolved security blockers. The highest-risk issues are a live unauthenticated data exposure through the public MCP endpoint, unsafe marketplace URL validation that can allow dangerous schemes to be stored and rendered, and a known-vulnerable Next.js version in production.

## Critical / High Findings

### AMC-SEC-001 High: Public MCP endpoint exposes non-public model records via service-role access

Affected files:
- `src/app/api/mcp/route.ts`
- `src/lib/mcp/server.ts`
- `src/lib/mcp/tools.ts`

Evidence:
- `src/app/api/mcp/route.ts:13-17` creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY`.
- `src/app/api/mcp/route.ts:38-56` makes API key auth optional for read-only requests.
- `src/app/api/mcp/route.ts:85-86` passes the service-role client into the MCP handler.
- `src/lib/mcp/server.ts:44-50` allows any caller to invoke `tools/call`.
- `src/lib/mcp/tools.ts:169-177` fetches a model by slug without restricting `status = active`.

Live verification:
- An unauthenticated JSON-RPC call to `/api/mcp` returned a deprecated model row for `openai-gpt-3-5-turbo`, proving exposure of non-active records in production.

Impact:
- Public callers can retrieve deprecated or otherwise non-public model records and related joined data.
- The endpoint is backed by a service-role client, so any future read tool mistakes will bypass row-level protections entirely.

Recommended remediation:
- Do not use a service-role client for unauthenticated MCP reads.
- Require authentication for privileged MCP operations.
- Restrict public model fetches to explicit allowlisted fields and `status = active`.
- Review the full MCP tool surface for other read paths with the same trust issue.

### AMC-SEC-002 High: Marketplace URLs accept dangerous schemes and are rendered into public links

Affected files:
- `src/app/api/marketplace/listings/route.ts`
- `src/app/api/marketplace/listings/[slug]/route.ts`
- `src/app/api/marketplace/seller/verify/route.ts`
- `src/app/(marketplace)/marketplace/[slug]/page.tsx`
- `src/components/marketplace/seller-card.tsx`

Evidence:
- `src/app/api/marketplace/listings/route.ts:82-96` validates public URLs with `z.string().url()` only.
- `src/app/api/marketplace/listings/[slug]/route.ts:129-167` copies `documentation_url`, `demo_url`, and `source_url` directly from request data with no scheme restriction.
- `src/app/api/marketplace/seller/verify/route.ts:102-107` validates `website_url` and `portfolio_url` with `z.string().url()`.
- `src/app/(marketplace)/marketplace/[slug]/page.tsx:435-450` renders `demo_url` and `documentation_url` directly into anchors.
- `src/components/marketplace/seller-card.tsx:96-105` renders `seller_website` directly into an anchor.

Verification:
- Local validation check confirmed `z.string().url()` accepts `javascript:`, `data:`, and `ftp:` URIs in addition to `https:`.

Impact:
- Attackers can store dangerous or misleading links and have them rendered back to users.
- This creates a practical phishing / script-scheme exposure in public marketplace surfaces.

Recommended remediation:
- Replace bare `z.string().url()` checks with an `http:` / `https:` scheme allowlist.
- Revalidate and clean existing stored URLs in marketplace and seller-profile data.
- Centralize external-link validation so create, update, and render paths use the same rule.

### AMC-SEC-003 High: Production ships with a known-vulnerable Next.js release

Affected files:
- `package.json`

Evidence:
- `package.json:57` pins `next` to `16.1.6`.
- Local `npm audit --omit=dev` reports `GHSA-q4gf-8mx6-v5v3`.
- GitHub Advisory `GHSA-q4gf-8mx6-v5v3` lists affected versions `>= 16.0.0-beta.0, < 16.2.3` and patched version `16.2.3`.

Impact:
- Production remains exposed to a published App Router denial-of-service issue until upgraded.

Recommended remediation:
- Upgrade `next` and the matching `eslint-config-next` package to a patched release.
- Re-run build, typecheck, tests, and a focused request-flood sanity check on App Router endpoints after the upgrade.

## Medium Findings

### AMC-SEC-004 Medium: CSP still allows unsafe inline script/style execution

Affected files:
- `src/lib/csp.ts`

Evidence:
- `src/lib/csp.ts:10-16` includes `'unsafe-inline'` in `script-src`.
- `src/lib/csp.ts:29-30` includes `'unsafe-inline'` in `style-src`.
- Live production headers served the same relaxed CSP.

Impact:
- CSP provides materially weaker protection against XSS than a nonce- or hash-based policy.

Recommended remediation:
- Move script/style allowances to nonces or hashes.
- Remove `'unsafe-inline'` in production if the app can be made compatible.

### AMC-SEC-005 Medium: Sensitive cookie-authenticated write routes lack explicit origin / CSRF enforcement

Affected files:
- `src/app/api/auth/delete-account/route.ts`
- `src/app/api/admin/moderate/route.ts`

Evidence:
- `src/app/api/auth/delete-account/route.ts:21-41` accepts an authenticated destructive request based only on session state and a static `DELETE` confirmation string.
- `src/app/api/admin/moderate/route.ts:22-60` performs privileged admin writes without explicit origin or referer validation.

Impact:
- SameSite cookie protections reduce risk, but explicit request-origin enforcement is missing on sensitive session-authenticated mutations.
- Account deletion also lacks step-up reauthentication for an irreversible action.

Recommended remediation:
- Add origin / referer validation for session-authenticated write routes.
- Require recent reauthentication for delete-account and comparable destructive actions.

## Dependency Observations

Local dependency inspection also surfaced:
- `posthog-js` pulling `protobufjs@7.5.4`, while current advisories include a patched line at `7.5.5`.
- `@solana/web3.js@1.98.4` with moderate audit findings.

These are not the top launch blockers compared with the issues above, but they should be tracked and remediated in the next dependency-hardening pass.

## Verification Performed

- Inspected auth, admin, marketplace, MCP, and security-header code paths.
- Queried live production headers from `https://aimarketcap.tech`.
- Verified a live unauthenticated MCP read of a deprecated model record from production.
- Ran `npm audit --omit=dev --json`.
- Checked the active dependency tree with `npm ls`.
- Performed a local validator sanity check showing `z.string().url()` accepts non-HTTP schemes.

## Launch Gate Decision

The website is live and functionally operating, but it is not yet verified for secure public launch.

Minimum launch blockers to clear:
1. Lock down the public MCP endpoint.
2. Restrict marketplace and seller URLs to `http` / `https` only and clean stored data.
3. Upgrade Next.js to a patched release and verify the upgrade.

After those are fixed, re-run a targeted launch-readiness pass covering auth, privileged writes, public rendering paths, and abuse handling.
