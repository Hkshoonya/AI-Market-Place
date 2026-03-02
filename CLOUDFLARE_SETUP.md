# Cloudflare Setup Guide (Free Tier)

## Why Cloudflare

- **CDN**: Static assets served from 300+ edge locations worldwide
- **DDoS Protection**: Automatic L3/L4/L7 attack mitigation
- **SSL**: Free universal SSL certificates
- **Caching**: Reduces Vercel bandwidth usage (saves hitting the 100 GB Hobby limit)
- **Analytics**: Free web analytics (privacy-friendly, no cookies)
- **Cost**: $0/mo

## Setup Steps

### 1. Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with your email

### 2. Add Your Domain

1. Click **"Add a site"** in the dashboard
2. Enter your domain (e.g., `aimarketcap.com`)
3. Select the **Free plan**
4. Cloudflare will scan existing DNS records

### 3. Update Nameservers

1. Cloudflare will give you 2 nameservers (e.g., `ada.ns.cloudflare.com`)
2. Go to your domain registrar (Namecheap, GoDaddy, etc.)
3. Replace existing nameservers with the Cloudflare ones
4. Wait 24-48 hours for propagation (usually faster)

### 4. Configure DNS Records

Add these DNS records in Cloudflare:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `cname.vercel-dns.com` | Proxied (orange cloud) |
| CNAME | `www` | `cname.vercel-dns.com` | Proxied (orange cloud) |

### 5. SSL/TLS Settings

1. Go to **SSL/TLS** > **Overview**
2. Set encryption mode to **Full (strict)**
3. Go to **Edge Certificates** > Enable:
   - Always Use HTTPS: **ON**
   - Automatic HTTPS Rewrites: **ON**
   - Minimum TLS Version: **TLS 1.2**

### 6. Caching Rules

Go to **Caching** > **Configuration**:
- Browser Cache TTL: **Respect Existing Headers** (our next.config.ts already sets these)

Go to **Rules** > **Page Rules** (3 free rules):

| Rule | URL Pattern | Setting |
|------|------------|---------|
| 1 | `*aimarketcap.com/api/*` | Cache Level: Bypass |
| 2 | `*aimarketcap.com/*.svg` | Cache Level: Cache Everything, Edge TTL: 1 month |
| 3 | `*aimarketcap.com/` | Cache Level: Standard |

### 7. Speed Optimizations

Go to **Speed** > **Optimization**:
- Auto Minify: Enable **JavaScript**, **CSS**, **HTML**
- Brotli compression: **ON**
- Early Hints: **ON**
- Rocket Loader: **OFF** (can break React hydration)

### 8. Security Settings

Go to **Security** > **Settings**:
- Security Level: **Medium**
- Bot Fight Mode: **ON**
- Browser Integrity Check: **ON**

### 9. Configure Vercel

In your Vercel project settings:
1. Go to **Domains**
2. Add your domain (e.g., `aimarketcap.com`)
3. Vercel will detect Cloudflare and show instructions
4. The CNAME records from step 4 handle the connection

### 10. Verify

After setup, test:
```bash
# Check headers for Cloudflare
curl -I https://aimarketcap.com

# Should see: cf-ray, cf-cache-status headers
```

## GitHub Actions Secrets

After deployment, add these secrets to your GitHub repo for the cron workflows:

1. Go to GitHub repo > **Settings** > **Secrets and variables** > **Actions**
2. Add:
   - `SITE_URL`: Your deployed URL (e.g., `https://aimarketcap.com`)
   - `CRON_SECRET`: Your CRON_SECRET value

## Supabase pg_cron for Auctions

After deployment, activate the auction cron job in Supabase SQL editor:

```sql
SELECT cron.schedule(
  'process-auctions',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://aimarketcap.com/api/cron/auctions',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Replace `YOUR_CRON_SECRET` with your actual cron secret.
