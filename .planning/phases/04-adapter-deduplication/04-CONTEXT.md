# Phase 4: Adapter Deduplication - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract ~904 lines of duplicated KNOWN_MODELS data from 4 adapter files into shared data files. Unify 5 inferCategory() implementations into a single shared function with provider-specific keyword maps. Create a shared buildRecord() factory and a createAdapterSyncer() factory that encapsulates the static-scrape-API-upsert pipeline used by 3 adapters. Zero behavior change — all sync output must be identical before and after.

</domain>

<decisions>
## Implementation Decisions

### KNOWN_MODELS data format
- TypeScript data files (not JSON) — consistent with Phase 1 decision for scoring constants
- One file per provider: `known-models/anthropic.ts`, `known-models/openai.ts`, `known-models/google.ts`, `known-models/replicate.ts`
- Unified superset `KnownModelMeta` interface across all providers (some fields optional) — enables the shared buildRecord() factory
- Model ID as key (current pattern): `Record<string, KnownModelMeta>` keyed by model ID (e.g., `claude-opus-4-6`). Replicate adapts from its current array format to match

### Shared module organization
- New directory: `src/lib/data-sources/shared/` alongside existing `adapters/`
- Known models data inside shared: `shared/known-models/anthropic.ts`, etc.
- Factory modules: `shared/build-record.ts`, `shared/infer-category.ts`, `shared/adapter-syncer.ts`
- Direct imports (no barrel index.ts) — matches existing codebase convention
- `utils.ts` stays in its current location (`src/lib/data-sources/utils.ts`) — already established and imported by all adapters, moving would create unnecessary churn

### inferCategory unification
- Claude's discretion on exact approach — pick whichever of single-function-with-maps vs strategy pattern keeps the code simplest while satisfying ADAPT-02
- Unify all 5 implementations: openai, google, replicate, openrouter, github-trending — full deduplication
- Include inferModalities alongside inferCategory in the same shared module (duplicated in openai and google)
- Keyword maps inline in the shared module (not externalized to separate config)

### Adapter syncer factory
- Apply factory to the 3 matching adapters only: anthropic, openai, google (all follow static-scrape-API-upsert). Replicate stays standalone — its fallback-OR-live pattern is fundamentally different
- Claude's discretion on factory interface — pick config-object vs hook-based approach based on what eliminates the most duplication while staying maintainable
- Factory produces both sync() and healthCheck() — the 3 adapters have near-identical healthCheck implementations too
- Claude's discretion on adapter thinness — find the right balance between ultra-thin (~20 lines) and moderate (~50-80 lines with custom overrides). Provider-specific quirks like OpenAI's ALLOWED_OWNERS filter and Anthropic's pagination need to fit cleanly

### Claude's Discretion
- Exact KnownModelMeta unified interface fields and which are optional
- Factory function interface design (config object vs hooks)
- How provider-specific scrape patterns and API fetch functions are injected into the factory
- Whether Replicate's KNOWN_MODELS array format gets a different KnownModelMeta variant or converts to the unified shape
- Internal structure of the shared inferCategory function

</decisions>

<specifics>
## Specific Ideas

- This is pure structural refactoring — same patterns as Phases 2 and 3 (extract shared code, zero behavior change)
- The 3 provider adapters (anthropic, openai, google) have nearly identical sync() bodies with only provider-specific URLs, auth headers, and response types differing — the factory should capture this pattern
- Replicate's inferCategory works on description text (keyword matching) while OpenAI/Google work on model ID prefixes — the shared function needs to handle both input types

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/data-sources/utils.ts`: fetchWithRetry, makeSlug, upsertBatch, createRateLimitedFetch — already shared by all adapters
- `src/lib/data-sources/types.ts`: DataSourceAdapter, SyncContext, SyncResult, HealthCheckResult interfaces
- `src/lib/data-sources/registry.ts`: registerAdapter() function used by all adapters

### Established Patterns
- All model adapters follow: import types + registry + utils, define static data, implement sync()/healthCheck(), call registerAdapter(), export default adapter
- Static-scrape-API-upsert pipeline: 3 adapters build recordMap from KNOWN_MODELS, try scrape, try API, upsert batch
- buildRecord() pattern: merge known data with overrides, apply provider defaults, call makeSlug with provider prefix

### Duplication Map
- KNOWN_MODELS: anthropic (229 lines), openai (494 lines), google (309 lines), replicate (289 lines) = ~1321 lines of static data in adapter source files
- KnownModelMeta interface: 4 different definitions with overlapping fields
- inferCategory(): 5 implementations (openai:model-ID, google:model-ID, replicate:description, openrouter:modalities, github-trending:topics+description)
- inferModalities(): 2 implementations (openai, google) — both use model ID prefix matching
- buildRecord(): 3 implementations (anthropic, openai, google) — differ in provider name, default fields, which infer* functions to call
- sync() body: 3 near-identical implementations (anthropic, openai, google) — same 4-step pipeline with different URLs/headers/response types
- healthCheck(): 3 near-identical implementations — same "no key = static healthy, key = ping API" pattern

### Integration Points
- 4 adapter files will be significantly refactored: anthropic-models.ts, openai-models.ts, google-models.ts, replicate.ts
- 2 additional adapter files will have inferCategory migrated: openrouter-models.ts, github-trending.ts
- New shared/ directory created alongside adapters/
- All adapters continue to registerAdapter() and export default adapter

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-adapter-deduplication*
*Context gathered: 2026-03-03*
