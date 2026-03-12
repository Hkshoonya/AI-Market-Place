# Requirements: AI Market Cap

**Defined:** 2026-03-11
**Core Value:** Most comprehensive, multi-lens ranking of AI models — single source of truth for discovery, comparison, and evaluation.

## v1.2 Requirements

Requirements for Data Pipeline & Launch milestone. Each maps to roadmap phases.

### Data Pipeline

- [x] **PIPE-01**: System seeds `data_sources` table with all 27 adapters on first deploy
- [x] **PIPE-02**: `resolveSecrets()` fails fast with clear error when required API keys are missing
- [x] **PIPE-03**: Orchestrator reports per-adapter success/failure status (not silent 200 OK)
- [x] **PIPE-04**: All adapter API keys validated on app startup with clear log output
- [x] **PIPE-05**: Failed syncs automatically retry with exponential backoff (max 3 retries)
- [x] **PIPE-06**: Each adapter exposes a health check (connectivity + auth validation)
- [x] **PIPE-07**: `/api/pipeline/health` endpoint returns aggregate pipeline status

### Admin Visibility

- [x] **ADMN-01**: Admin dashboard shows sync job history (status, errors, timestamps, records processed)
- [x] **ADMN-02**: Admin dashboard highlights stale data sources (no successful sync within expected interval)
- [x] **ADMN-03**: Admin dashboard shows pipeline health overview (healthy/degraded/down per adapter)
- [ ] **ADMN-04**: Admin can drill down to per-adapter error details and recent sync logs
- [ ] **ADMN-05**: Admin can manually trigger a sync for any individual adapter from the dashboard

### Deployment

- [ ] **DEPL-01**: App deploys to Railway via Docker with git-push workflow
- [ ] **DEPL-02**: All required env vars configured in Railway (Supabase, API keys, CRON_SECRET)
- [ ] **DEPL-03**: `node-cron` schedules all 8 cron jobs in-process (replaces Vercel cron)
- [ ] **DEPL-04**: DNS configured for aimarketcap.com via Cloudflare with SSL
- [ ] **DEPL-05**: `/api/health` endpoint returns app status, DB connectivity, and uptime

### Data Integrity

- [ ] **INTG-01**: End-to-end verification confirms data flows from adapters → DB → UI for all key tables
- [ ] **INTG-02**: System detects and reports empty tables that should have data
- [ ] **INTG-03**: Data freshness check flags sources that haven't updated within their expected interval
- [ ] **INTG-04**: Data quality score per source measuring completeness, freshness, and record count trends

## Future Requirements

### Notifications & Alerting

- **ALRT-01**: External alerting (email/Discord) when sync failures exceed threshold
- **ALRT-02**: Scheduled pipeline health report sent to admin

### Scaling

- **SCAL-01**: Migration playbook from Railway to Hetzner+Coolify when costs exceed threshold
- **SCAL-02**: Staging environment on Railway for pre-deploy testing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Supabase migration | Integration too deep (158 files); $25/mo is justified |
| Hetzner+Coolify deployment | Deferred to scaling phase; Railway first for simplicity |
| RSSHub sidecar on Railway | Railway single-service; X/Twitter adapter uses static fallback for now |
| WebSocket/real-time sync updates | Over-engineering for admin monitoring; polling sufficient |
| Full adapter rewrite | Adapters work; only fixing error handling and secret validation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 20 | Complete |
| PIPE-02 | Phase 20 | Complete |
| PIPE-03 | Phase 20 | Complete |
| PIPE-04 | Phase 20 | Complete |
| PIPE-05 | Phase 20 | Complete |
| PIPE-06 | Phase 20 | Complete |
| PIPE-07 | Phase 20 | Complete |
| ADMN-01 | Phase 21 | Complete |
| ADMN-02 | Phase 21 | Complete |
| ADMN-03 | Phase 21 | Complete |
| ADMN-04 | Phase 21 | Pending |
| ADMN-05 | Phase 21 | Pending |
| DEPL-01 | Phase 22 | Pending |
| DEPL-02 | Phase 22 | Pending |
| DEPL-03 | Phase 22 | Pending |
| DEPL-04 | Phase 22 | Pending |
| DEPL-05 | Phase 22 | Pending |
| INTG-01 | Phase 23 | Pending |
| INTG-02 | Phase 23 | Pending |
| INTG-03 | Phase 23 | Pending |
| INTG-04 | Phase 23 | Pending |

**Coverage:**
- v1.2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation — all 18 requirements mapped*
