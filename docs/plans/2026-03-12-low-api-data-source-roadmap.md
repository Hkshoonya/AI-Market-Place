# Low-API Data Source Roadmap

## Goal

Improve `aimarketcap.tech` data quality and coverage while minimizing direct API dependencies.

The selection rule is:

1. Official static JSON / CSV / dataset snapshot
2. Official GitHub repo or maintained artifact
3. Public dataset endpoint
4. Public API only when the source is uniquely valuable
5. HTML scraping only as a last resort

This reduces breakage, token/key cost, rate-limit risk, and auth sprawl.

## Source Policy

### Keep as primary

- `openrouter-models`
  - High value, broad coverage, single public API for model catalog + pricing context.
- `openai-models`
  - Provider-canonical metadata.
- `anthropic-models`
  - Provider-canonical metadata.
- `google-models`
  - Provider-canonical metadata.
- `huggingface`
  - Strong ecosystem/popularity signal.
- `artificial-analysis`
  - One of the few API-based sources worth keeping because it combines benchmarks, latency, and pricing in a stable productized feed.
- `open-llm-leaderboard`
  - Good dataset-backed benchmark source for open models.
- `open-vlm-leaderboard`
  - Keep, but only via OpenXLab JSON feed.
- `livebench`
  - Keep as an official repo/artifact-backed benchmark.
- `chatbot-arena`
  - Keep for preference/ELO coverage if public export remains stable.

### Keep with lower strategic weight

- `arxiv`
- `hf-papers`
- `provider-news`
- `github-trending`
- `github-stars`
- `deployment-pricing`

These are useful, but they should not be treated as the core truth layer.

### Retain, but quarantine when broken

- `seal-leaderboard`
  - Keep it registered, but quarantine it when the upstream is not a stable public machine-readable source.
- Any adapter that depends on a private, gated, or undocumented dataset endpoint
  - Quarantine it unless there is a public snapshot source. Do not delete the adapter if it may become valuable later.

## Recommended Additions

### Priority 1: High value, low API reliance

- `livecodebench`
  - Source type: official GitHub/repo-backed artifacts
  - Why: coding coverage is essential and currently underrepresented
  - API cost: low
- `swe-bench`
  - Source type: official leaderboard/site + repo artifacts
  - Why: software-engineering/agent quality signal
  - API cost: low
- `arena-hard-auto`
  - Source type: official repo/artifacts
  - Why: practical replacement candidate for brittle instruction-following leaderboard sources
  - API cost: low

### Priority 2: Multimodal / agent depth

- `vision-arena`
  - Source type: public leaderboard/export if available
  - Why: human preference signal for multimodal models
  - API cost: low to medium depending on export path
- `terminal-bench`
  - Source type: official repo/artifacts
  - Why: terminal-agent capability is strategically aligned with current market demand
  - API cost: low
- `osworld`
  - Source type: official repo/artifacts
  - Why: GUI/desktop agent signal
  - API cost: low

### Priority 3: Optional, only if stable public exports exist

- `healthbench`
- `mmlu-pro` aggregate result exports
- `webarena` public artifacts

Do not add these if they require fragile scraping or frequent auth churn.

## Coverage Model

The target is one strong source per capability class, not many overlapping sources.

- Catalog / pricing truth
  - Official provider sources
  - OpenRouter
- Open-model benchmark depth
  - Open LLM Leaderboard
  - LiveBench
- Multimodal benchmark depth
  - OpenVLM
  - Vision Arena
- Coding quality
  - LiveCodeBench
- Agentic software quality
  - SWE-bench
  - Terminal-Bench
- Preference / real-world ranking
  - Chatbot Arena
  - Arena-Hard-Auto
- Ecosystem/news/popularity
  - Hugging Face
  - GitHub
  - provider-news
  - arXiv

## API Minimization Strategy

### Prefer these patterns

- Static JSON published by the benchmark owner
- GitHub-hosted leaderboard snapshots
- Hugging Face datasets that are public and stable
- Public CSV/Parquet exports

### Avoid these patterns

- Authenticated APIs for data that also exists as public artifacts
- Private or gated HF datasets
- Browser-only pages with no stable backing export
- Multiple APIs for the same dimension when one canonical source is enough

### Ideal steady-state

- Core provider/catalog APIs: 4 to 6
- Premium benchmark API: 1 (`artificial-analysis`)
- Everything else: static feeds, datasets, repos, or public exports

That keeps the platform mostly artifact-driven rather than API-driven.

## Execution Order

### Phase 1

- Keep current provider/catalog stack
- Keep `artificial-analysis`
- Keep `open-llm-leaderboard`
- Keep `livebench`
- Keep fixed `open-vlm-leaderboard`
- Keep `seal-leaderboard` registered, but allow quarantine/degradation when its upstream is broken

### Phase 2

- Add `livecodebench`
- Add `swe-bench`
- Add `arena-hard-auto`

### Phase 3

- Add `vision-arena` if a stable export path exists
- Tighten source weighting and dedupe overlapping benchmark dimensions

## Product Rules

- Every source must store upstream snapshot time separately from local sync time.
- Failed syncs must never advance freshness timestamps.
- Permanent upstream failures should auto-quarantine the source.
- Broken sources must degrade or quarantine cleanly instead of disappearing from the registry.
- Health and integrity reports must ignore disabled sources.
- The admin UI should show:
  - active
  - degraded
  - quarantined
  - disabled by operator

## Recommended Final Stack

If the goal is strong coverage with minimal API surface, the recommended long-term stack is:

- Official provider catalogs: OpenAI, Anthropic, Google, OpenRouter
- Ecosystem: Hugging Face
- Premium aggregate API: Artificial Analysis
- Open benchmark datasets/artifacts: Open LLM Leaderboard, LiveBench, OpenVLM
- Coding/agent artifacts: LiveCodeBench, SWE-bench, Terminal-Bench
- Preference signals: Chatbot Arena, Arena-Hard-Auto, Vision Arena
- News/research/popularity: provider-news, arXiv, GitHub

This is the best tradeoff between quality, survivability, and operational simplicity.
