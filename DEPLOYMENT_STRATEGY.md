# AI Market Cap - Deployment Strategy

## Current State Assessment

### What We Have Now

| Component | Current | Cost | Limits |
|-----------|---------|------|--------|
| **Frontend + API** | Vercel (Hobby/Pro) | $0-20/mo | 100 GB bandwidth (Hobby), 1 TB (Pro) |
| **Database** | Supabase Free | $0/mo | 500 MB DB, 1 GB storage, 50K auth MAU |
| **Cron Jobs** | 9 jobs in vercel.json | Running | All 9 crons active and executing on schedule |
| **Edge Functions** | 1 Supabase edge fn | $0 | 500K invocations/mo |
| **Domain** | Vercel subdomain | $0 | N/A |

### Database Size (Current)

| Table | Rows | Size |
|-------|------|------|
| models | 968 | 5.0 MB |
| model_news | 1,780 | 2.5 MB |
| model_snapshots | 3,017 | 928 KB |
| benchmark_scores | 797 | 488 KB |
| model_pricing | 660 | 336 KB |
| 45 other tables | ~1,600 | ~1.5 MB |
| **Total** | ~8,900 | **~11 MB** |

**Key Insight**: The database is tiny. We're using <3% of the 500 MB free tier.

### Cron Jobs: Healthy and Running

All 9 cron jobs in `vercel.json` are active. Last batch ran March 2, 2026:

| Cron Job | Schedule | Status |
|----------|----------|--------|
| sync tier=1 | Every 6 hrs | Running (livebench, chatbot-arena, etc.) |
| sync tier=2 | Every 12 hrs | Running (artificial-analysis, open-llm-leaderboard) |
| sync tier=3 | Daily 8 AM | Running (hf-papers, arxiv, x-announcements) |
| sync tier=4 | Weekly Mon | Running (github-stars, deployment-pricing) |
| compute-scores | Every 6 hrs | Running |
| agents/pipeline | Every 6 hrs | Running |
| agents/code-quality | Daily 9 AM | Running |
| agents/ux-monitor | Weekly Mon | Running |
| auctions | Every 5 min | Running (288x/day — consider reducing if unused) |

---

## Recommended Architecture: The $0-$25/mo Stack

### Option A: Stay on Vercel + Supabase (Current — Recommended for now)

```
Vercel               Supabase Free         Cloudflare (Free)
+--------------+     +---------------+     +------------------+
| Next.js SSR  |     | PostgreSQL    |     | CDN / DDoS       |
| API Routes   |<--->| Auth          |     | DNS              |
| 9 Cron Jobs  |     | Edge Functions|     | SSL              |
| Static pages |     +---------------+     | Caching          |
+--------------+                           +------------------+
```

**When you need more ($5-25/mo)**

| Trigger | Upgrade | Cost |
|---------|---------|------|
| >100 GB bandwidth/mo | Vercel Pro | $20/mo |
| >500 MB database | Supabase Pro | $25/mo |
| Need custom domain SSL | Vercel Pro or Cloudflare | $0-20/mo |
| Need email (transactional) | Resend free tier | $0 (3K emails/mo) |

---

### Option B: VPS + Supabase (Cheapest for scale)

For maximum control at minimum cost, move the Next.js app to a VPS and keep Supabase for the database.

```
Hetzner VPS (CX22)    Supabase Free         Cloudflare (Free)
+--------------+       +---------------+     +------------------+
| Next.js      |       | PostgreSQL    |     | CDN / DDoS       |
| Node.js 20   |       | Auth          |     | DNS              |
| PM2 cluster  |<----->| Edge Functions|     | SSL              |
| Built-in cron|       +---------------+     | Caching          |
+--------------+                             +------------------+
       |
    Docker + Caddy (auto-SSL)
```

**Hetzner CX22**: 2 vCPU, 4 GB RAM, 40 GB NVMe, 20 TB bandwidth - **$4.50/mo**

**Setup:**

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
services:
  app:
    build: .
    restart: always
    ports:
      - "3000:3000"
    env_file: .env.production

  caddy:
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
```

**Cron jobs** run natively via crontab on the VPS:

```bash
# /etc/cron.d/aimarketcap
0 */6 * * *  curl -s http://localhost:3000/api/cron/sync?tier=1 -H "Authorization: Bearer $CRON_SECRET"
45 */6 * * * curl -s http://localhost:3000/api/cron/compute-scores -H "Authorization: Bearer $CRON_SECRET"
*/5 * * * *  curl -s http://localhost:3000/api/cron/auctions -H "Authorization: Bearer $CRON_SECRET"
# ... etc
```

| Component | Cost |
|-----------|------|
| Hetzner CX22 | $4.50/mo |
| Supabase Free | $0/mo |
| Cloudflare Free | $0/mo |
| Domain (.com) | ~$10/year |
| **Total** | **~$5.30/mo** |

**Pros**: Unlimited cron, unlimited bandwidth (20 TB), full control, no cold starts, runs PM2 cluster mode (uses both CPU cores).

**Cons**: You manage the server (updates, monitoring). Mitigated by Docker + auto-restart.

---

### Option C: Railway / Render (Middle ground)

```
Railway ($5/mo)        Supabase Free
+--------------+       +---------------+
| Next.js      |       | PostgreSQL    |
| Built-in cron|<----->| Auth          |
| Auto-deploy  |       | Edge Functions|
+--------------+       +---------------+
```

- **Railway**: $5/mo includes 8 GB RAM, 8 vCPU, cron jobs native, auto-deploy from GitHub
- **Render**: Free tier web service (750 hrs/mo) + cron jobs on paid ($7/mo)

---

## Recommendation Matrix

| Criteria | Vercel Free + GH Actions | VPS (Hetzner) | Railway |
|----------|--------------------------|---------------|---------|
| **Monthly Cost** | $0 | $5 | $5 |
| **Setup Effort** | Low | Medium | Low |
| **Cron Jobs** | Workaround (GH Actions) | Native | Native |
| **Cold Starts** | Yes (serverless) | No | No |
| **Bandwidth** | 100 GB | 20 TB | 100 GB |
| **Auto-deploy** | Yes (Vercel) | Manual/CI | Yes |
| **Scaling** | Auto | Manual | Auto |
| **SSL/Domain** | Built-in | Caddy auto-SSL | Built-in |
| **Maintenance** | Zero | Some | Zero |
| **Best for** | Getting started | Long-term production | Quick production |

---

## My Recommendation: Phased Approach

### Right Now (Week 1): Optimize What You Have

1. **Add Cloudflare DNS** (free) - CDN caching, DDoS protection, analytics
2. **Add cache headers** to heavy API routes (models, charts) - reduces serverless usage
3. **Enable Next.js `output: 'standalone'`** in next.config.ts - prepares for future VPS migration
4. **Lazy load heavy client libs** (Three.js, Solana, viem) - faster page loads
5. **Review auctions cron** - every 5 min (288x/day) is aggressive if marketplace is empty

### Month 1-3: Validate Product

Stay on current Vercel + Supabase Free stack. Total: **$0-20/mo**.

Focus on getting real users, real marketplace listings, real traffic data.

### When You Hit Limits: Migrate to VPS

When any of these happen:
- Vercel bandwidth >100 GB/mo (means real traffic)
- Supabase DB >400 MB (means real data growth)
- Need faster API responses (no cold starts)
- Want to cut costs from Vercel Pro $20/mo

Migrate to **Hetzner CX22 + Supabase Free + Cloudflare**: **$5/mo** with room to grow.

---

## Optimization Checklist

### Immediate Wins (Do Now)

- [ ] **Enable `output: 'standalone'`** in next.config.ts (reduces deploy size 80%)
- [ ] **Add `Cache-Control: s-maxage=300`** to read-heavy API routes (models, charts)
- [ ] **Remove Three.js** if the 3D globe isn't critical - it's 500KB+ in the bundle
- [ ] **Remove unused tables** - 20+ tables have 0 rows (game_archive, predictions, simulation_cache, etc.)
- [ ] **Lazy load Recharts** - dynamic import charts only when visible

### Bundle Size Reduction

Current heavy dependencies and alternatives:

| Package | Size | Action |
|---------|------|--------|
| three + @react-three/* | ~600 KB | Remove if globe unused, or dynamic import |
| recharts | ~300 KB | Keep but lazy load per chart |
| @solana/web3.js | ~200 KB | Dynamic import only on wallet page |
| viem | ~150 KB | Dynamic import only on wallet page |
| lightweight-charts | ~200 KB | Dynamic import only on chart pages |
| @anthropic-ai/sdk | ~100 KB | Server-only, OK |

**Estimated savings**: ~1 MB from client bundle by lazy loading blockchain + 3D.

### Database Optimization

```sql
-- Drop empty tables that serve no purpose
-- (Review each before dropping)
DROP TABLE IF EXISTS game_archive;
DROP TABLE IF EXISTS predictions;
DROP TABLE IF EXISTS simulation_cache;
DROP TABLE IF EXISTS rlhf_feedback;
DROP TABLE IF EXISTS model_descriptions;

-- Add pg_cron for auction processing (free, in-database)
SELECT cron.schedule('process-auctions', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.site_url') || '/api/cron/auctions',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  )$$
);
```

### Caching Strategy

```
Request Flow:

User -> Cloudflare CDN -> Vercel Edge -> API Route -> Supabase
        (static cache)   (ISR cache)    (s-maxage)   (query)

Layer 1: Cloudflare - Cache static assets, HTML pages (TTL: 1hr)
Layer 2: Next.js ISR - Revalidate model pages every 5 min
Layer 3: API Cache-Control - s-maxage=300 on /api/models, /api/charts
Layer 4: Supabase - Connection pooling (already handled)
```

Add to API routes:

```typescript
// Example: models list API
return NextResponse.json({ data }, {
  headers: {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  },
});
```

---

## Long-Term Cost Projection

### Scenario: 10K daily visitors, 1000 models, active marketplace

| Stack | Monthly Cost | Notes |
|-------|-------------|-------|
| Vercel Pro + Supabase Free | $20 | Vercel Pro needed for bandwidth + crons |
| Hetzner CX22 + Supabase Free + CF | $5 | Most cost-efficient |
| Hetzner CX32 + Supabase Pro + CF | $18 | If DB exceeds 500 MB |
| Railway + Supabase Pro | $30 | Easiest managed option |

### Scenario: 100K daily visitors, marketplace revenue

| Stack | Monthly Cost | Notes |
|-------|-------------|-------|
| Hetzner CX32 + Supabase Pro + CF | $35 | 4 vCPU, 8 GB RAM, 500 GB DB |
| Vercel Pro + Supabase Pro | $45 | Managed but costlier |
| AWS/GCP | $100-300+ | Overkill unless you need specific services |

---

## Summary: What To Do This Week

1. **Add `output: 'standalone'`** to next.config.ts (reduces deploy size ~80%)
2. **Add cache headers** to top 5 most-hit API routes
3. **Sign up for Cloudflare** (free) and point your domain there
4. **Dynamic import** Three.js, Solana, and viem (client bundle diet)
5. **Review auctions cron frequency** — every 5 min with 0 orders is wasteful

Your data pipeline is already healthy — all 9 crons running, 968 models synced, 10 days of snapshots. Focus on optimization, not fixing.
