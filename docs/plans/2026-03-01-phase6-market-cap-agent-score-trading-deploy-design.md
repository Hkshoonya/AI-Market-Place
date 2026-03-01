# Phase 6 Design: Market Cap, Agent Score, Trading Graphs, Deploy Tab & Model Descriptions

**Date**: 2026-03-01
**Status**: Approved
**Approach**: All-at-once Phase 6 (tightly coupled features built together)

---

## 1. Market Cap & Popularity Column

### Purpose
A new "Market Cap" column representing estimated monthly API revenue (usage volume x price), plus a "Popularity" metric showing community adoption.

### Data Sources (API-based, no scraping by default)
1. **HuggingFace downloads + likes** — already collected every 6 hours
2. **OpenRouter `/api/v1/models`** — existing adapter, pricing + metadata
3. **Provider announcements** — curated estimates (ChatGPT ~300M weekly, Claude ~100M+, etc.)
4. **GitHub stars + forks** — new lightweight adapter from `github_url` on models
5. **Social velocity** — news mentions from existing `model_news` table
6. **Google Cloud Vertex / HF Inference API stats** — where public APIs exist

### Admin Toggle
Data Collection Mode in admin settings:
- **API-only** (default) — only official APIs and existing data
- **Extended** — enables OpenRouter rankings page data collection + additional web sources

### Calculation
```
popularity_score = weighted_blend(
  hf_downloads_normalized(30%),
  hf_likes_normalized(15%),
  github_stars_normalized(15%),
  news_mentions_velocity(15%),
  provider_usage_estimate(15%),
  trending_score(10%)
)
market_cap = popularity_score x blended_api_price x scale_factor
```

### Display
- **Homepage table**: "Popularity" column with mini bar chart (relative to top) + rank
- **Leaderboard explorer**: Full "Market Cap" column showing "$XXM est." with trend arrow
- **Model detail page**: "Market Overview" card in stats grid with sparkline

### DB Changes
- `market_cap_estimate` (numeric, nullable) + `popularity_rank` (integer) on `models`
- `market_cap_estimate` + `popularity_score` on `model_snapshots`
- `github_stars`, `github_forks` on `models`

---

## 2. Agent Score (Combined Benchmark Column)

### Purpose
A new "Agent Score" combining 9 agentic/real-world benchmarks with dynamic weighting. Separate ranking — does NOT affect Quality Score.

### 9 Benchmarks
| Benchmark | What It Tests | Data Source |
|-----------|---------------|-------------|
| SWE-Bench Verified | GitHub issue fixing | SEAL adapter (existing) + static curated |
| TerminalBench 2.0 | Terminal/CLI tasks | New adapter: tbench.ai / Artificial Analysis |
| OSWorld | Desktop GUI agent tasks | New adapter: HF `xlangai/*` |
| GAIA | Real-world assistant tasks | New adapter: HF `gaia-benchmark/*` |
| WebArena | Web browsing agent tasks | New adapter: webarena.dev |
| Aider Polyglot | Multi-language code editing | Existing adapters |
| HumanEval | Code generation | Existing adapters |
| TAU-Bench | Tool-augmented understanding | New adapter: Scale/SEAL |
| AgentBench | Multi-environment agent eval | Existing adapters |

### Weighting
Dynamic by data coverage — each benchmark weighted proportionally to how many models have scores for it. Auto-adjusts as new data arrives. Coverage discount for models with fewer benchmarks.

### New Adapters
- `terminal-bench.ts` — tbench.ai / Artificial Analysis (Tier 4, weekly)
- `osworld.ts` — HuggingFace `xlangai/*` (Tier 4, weekly)
- `gaia-benchmark.ts` — HuggingFace `gaia-benchmark/*` (Tier 4, weekly)
- `webarena.ts` — webarena.dev leaderboard (Tier 4, weekly)
- `tau-bench.ts` — Scale/SEAL or HuggingFace (Tier 4, weekly)

### Rich Expanded View
When user clicks Agent Score in table:
1. **Radar chart** — 9 benchmark axes, model scores plotted, faded top-10 average overlay
2. **Breakdown table** — each benchmark with: raw score, normalized score, rank, trend arrow, source
3. **Strengths/Weaknesses summary** — auto-generated: "Excels at code (SWE-Bench #2). Weak on GUI (OSWorld #34)."
4. **Compare button** — side-by-side comparison modal with up to 3 models, overlapping radars
5. **"View Full Agent Leaderboard" link**

### Dedicated Agent Leaderboard Tab
- All 9 benchmark columns, sortable
- Composite Agent Score as primary sort
- Radar chart preview on hover
- Category/provider filters
- Clear "No data" vs "0 score" distinction

### DB Changes
- `agent_score` (numeric, nullable) + `agent_rank` (integer) on `models`
- New benchmark definition rows for all 9 benchmarks
- `agent_score` tracked in `model_snapshots`

---

## 3. Trading Terminal Experience

### 3A: Global Market Ticker
**Component**: `src/components/layout/market-ticker.tsx`
- Scrolling horizontal ticker below nav on every page
- Top 15 models: name, popularity score, delta (green/red), mini 24h sparkline
- Auto-scrolls, pauses on hover
- Data refreshes every snapshot cycle (6 hours)
- Bloomberg/CNBC style: dark bg (#0a0a0a), monospace numbers, color-coded deltas

### 3B: Homepage Trading Dashboard
- Featured model chart (full TradingView-style) replacing/augmenting Market Overview
- Default: #1 ranked model, switchable via dropdown
- "Top Gainers" and "Top Losers" mini cards (biggest popularity changes 24h/7d)

### 3C: TradingView-Style Chart Component
**Component**: `src/components/charts/trading-chart.tsx`
**Library**: `lightweight-charts` (TradingView open-source, MIT, 46KB gzipped)

Features:
- **Candlestick series**: Daily OHLC of popularity_score
- **Volume histogram**: Daily download deltas as bars below
- **Crosshair**: Full crosshair on hover with exact values
- **Time range**: 24h / 7d / 30d / 90d / 1Y / All
- **Technical indicators** (toggleable): 7d & 30d SMA, Bollinger Bands, RSI panel
- **Drawing tools**: Trend lines, horizontal levels (localStorage per user)
- **Multiple overlays**: Toggle popularity / downloads / quality score / market cap
- **Responsive**: Full-width desktop, simplified mobile (no drawing tools)
- **Theme**: Dark mode, green/red candles, #00d4aa accent

### 3D: Model Detail Page
- "Trends" tab becomes "Trading" tab
- Full TradingView chart as primary view
- Toggle: Popularity | Downloads | Quality Score | Market Cap
- Side panel: 52-week high/low, avg volume, volatility

### Data
Uses `model_snapshots` table (6-hourly). Cubic spline interpolation for smoother rendering. New `popularity_score` and `market_cap_estimate` columns on snapshots.

---

## 4. Deploy Tab & Affiliate Links

### Platform Coverage

| Category | Platforms |
|----------|-----------|
| **API Providers** | OpenRouter, OpenAI, Anthropic, Google AI Studio, Groq, Cerebras, Fireworks, Together AI, DeepInfra, Perplexity, Mistral, Cohere |
| **Cloud Hosting** | AWS Bedrock, Azure AI, GCP Vertex AI, HuggingFace Inference Endpoints, Replicate, Modal, Banana.dev |
| **Self-Host GPU** | RunPod, Lambda Cloud, Vast.ai, CoreWeave, Paperspace |
| **Local/Edge** | Ollama, LM Studio, llamacpp, GPT4All, Jan.ai |
| **Subscriptions** | ChatGPT Plus/Pro/Team, Claude Pro/Team/Enterprise, Gemini Advanced, Perplexity Pro, Copilot Pro, Grok Premium |

### Auto-Updating Pricing
**Adapter**: `src/lib/data-sources/adapters/deployment-pricing.ts`
- Fetches live pricing from platform APIs: OpenRouter, Replicate, Together AI, Fireworks, DeepInfra, Groq, HuggingFace
- Static curated for non-API platforms (AWS, Azure, GCP) — updated monthly
- Sync: Tier 3 (daily) for API-based, Tier 4 (weekly) for static
- Writes to `model_deployments` table with `last_price_check` timestamp

### DB Tables

**`deployment_platforms`**: id, slug, name, logo_url, type (api/hosting/subscription/self-hosted), affiliate_url_template, has_affiliate, affiliate_commission, base_url

**`model_deployments`**: model_id, platform_id, deploy_url, pricing_model (per-token/per-second/monthly/free), price_per_unit, unit_description, free_tier, one_click, status, last_price_check

### One-Click Deploy Automation
**Module**: `src/lib/deployment/deploy-actions.ts`
- **Replicate**: POST `/v1/deployments`
- **HuggingFace**: POST Inference Endpoints API
- **Modal**: Generate `modal deploy` command
- **Ollama**: Generate `ollama pull` command (copy-to-clipboard)
- **vLLM/Docker**: Generate `docker run` command with correct image + params
- Platforms without APIs: "Deploy" button opens platform model page with affiliate tracking

### Deploy Tab UI (model detail page)
1. **Pricing Comparison Table** (primary): sortable by price, speed, type. "Best Value" and "Fastest" badges. "Deploy" buttons with affiliate tracking.
2. **Subscription Models Section**: Feature comparison (rate limits, context, priority). Affiliate links.
3. **Self-Hosting Guide** (open-weight models): GPU requirements, Docker/vLLM/Ollama commands, GPU cloud provider links.

### Affiliate Tracking
Links use: `?ref=aimarketcap&utm_source=aimarketcap&utm_medium=deploy_tab`

### Affiliate Program Details

| Platform | Signup URL | Commission | Est. Monthly Rev |
|----------|-----------|------------|-------------------|
| Google Cloud | cloud.google.com/affiliate-program | Cash per new user | $500-2K |
| Perplexity | partners.dub.co/perplexity | $15-20 per install | $200-800 |
| RunPod | runpod.io/referral | Credits per referral | $100-400 |
| AWS Partner | aws.amazon.com/partners/register | Revenue share (negotiable) | $300-1K |
| Azure Partner | partner.microsoft.com/signup | Revenue share (negotiable) | $200-800 |
| OpenRouter | openrouter.ai (pitch direct) | API routing commission | $500-3K |
| Replicate | replicate.com (pitch direct) | Custom deal | $200-1K |
| Together AI | together.ai (pitch direct) | Custom deal | $100-500 |
| Lambda Cloud | lambdalabs.com/referral | Credits program | $100-300 |
| Vast.ai | vast.ai/referral | Credits program | $50-200 |

**Estimated total**: $2,250-$10,000/mo at ~50K monthly visits

---

## 5. Model Pros/Cons & Descriptions

### Purpose
Rich model descriptions with structured pros/cons, use cases, and comparisons. AI-generated initially, community-enriched over time.

### DB Table: `model_descriptions`
| Column | Type | Description |
|--------|------|-------------|
| model_id | uuid | FK to models |
| summary | text | 2-3 sentence overview |
| pros | jsonb | `[{title, description, source}]` |
| cons | jsonb | `[{title, description, source}]` |
| best_for | text[] | Use case tags |
| not_ideal_for | text[] | Anti-use case tags |
| comparison_notes | text | vs top alternatives |
| generated_by | enum | ai / community / curated |
| last_generated | timestamp | |
| upvotes / downvotes | integer | Community validation |

### AI Generation Pipeline
**Module**: `src/lib/agents/model-describer.ts`
- Uses existing agent infrastructure
- Input: benchmarks, pricing, ELO, capabilities, release date
- Output: structured pros/cons + summary + use cases
- Top 100 models initially, expands via agent processing
- Re-generates on >10% score shift

### Community Layer
- Users submit pros/cons (requires auth)
- Upvote/downvote existing items
- Tagged `source: "community"` vs `source: "ai"`
- Moderation via existing admin flagging + review queue

### Display (model detail page)
New "Overview" section above tabs:
- Summary paragraph
- Pros/Cons side-by-side cards (green check / red X)
- "Best for" and "Not ideal for" tag pills
- "Suggest a pro/con" button for community
- Upvote/downvote counts

---

## File Summary

| Feature | New Files | Modified Files |
|---------|-----------|----------------|
| Market Cap | github-adapter, admin settings | models table, snapshots, homepage, leaderboard |
| Agent Score | 5 adapters, agent-leaderboard tab | quality-calculator, leaderboard page, model detail |
| Trading Terminal | market-ticker, trading-chart | homepage, model detail, layout |
| Deploy Tab | deployment-pricing adapter, deploy-actions, deploy tab | model detail page |
| Pros/Cons | model-describer agent, descriptions API | model detail page |
| Affiliate Doc | affiliate-strategy.md | — |

**Estimated total**: ~25 new files, ~15 modified files

### New Dependencies
- `lightweight-charts` (TradingView open-source charting, MIT, 46KB)

---

## Verification Criteria

1. Market Cap column shows estimated values for top 50 models
2. Agent Score computed for models with at least 3 of 9 benchmarks
3. Trading chart renders candlesticks with crosshair + SMA lines
4. Market ticker scrolls across homepage with live-updating deltas
5. Deploy tab shows pricing comparison table with working deploy buttons
6. At least Google Cloud + Perplexity affiliate links active
7. AI-generated descriptions exist for top 100 models
8. Community pros/cons submission + voting works
9. All new data adapters fetch successfully on sync
10. `next build` passes with zero errors
