# Origin interruption fallback

Proxies the existing Railway origin using Worker Routes, without moving DNS or
changing the origin. Only HTML GET/HEAD requests to the two fixed website hosts
receive a branded 503 on origin 5xx or a network failure. Healthy responses stream
unchanged. API/health, auth callbacks, RSC and all mutation requests bypass the UI
replacement. No origin retries, database calls, credentials, public test switch,
or cached error pages are introduced. No recovery time is promised.

This covers failures before response headers. A failure after a streamed 200 has
started cannot be replaced here; application error boundaries cover render errors.
Cloudflare itself being unavailable remains outside this fallback's coverage.

Before deploying, check zone Worker routes for overlaps. Deploying creates routes
only for AI Market Cap. Rollback: remove these two routes, leaving DNS and the
origin unchanged. Never crash production to test this Worker.

```bash
node --test cloudflare/service-fallback/src/fallback.test.mjs
npx wrangler types cloudflare/service-fallback/worker-configuration.d.ts -c cloudflare/service-fallback/wrangler.jsonc
npx tsc -p cloudflare/service-fallback/tsconfig.json
npx wrangler deploy --dry-run -c cloudflare/service-fallback/wrangler.jsonc
```
