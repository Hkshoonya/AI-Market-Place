# Phase 4: Adapter Deduplication — Research

**Researched:** 2026-03-03
**Domain:** TypeScript module refactoring — shared factory extraction, data file separation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **KNOWN_MODELS data format:** TypeScript data files (not JSON). One file per provider:
  `known-models/anthropic.ts`, `known-models/openai.ts`, `known-models/google.ts`, `known-models/replicate.ts`
- **Unified KnownModelMeta interface:** Single superset interface across all providers (some fields optional) — enables the shared `buildRecord()` factory
- **Model ID as key for 3 providers:** `Record<string, KnownModelMeta>` keyed by model ID. Replicate adapts from its current array format to match.
- **New directory:** `src/lib/data-sources/shared/` alongside existing `adapters/`
- **Known models location:** `shared/known-models/anthropic.ts`, etc.
- **Factory modules:** `shared/build-record.ts`, `shared/infer-category.ts`, `shared/adapter-syncer.ts`
- **Direct imports (no barrel index.ts):** Matches existing codebase convention
- **utils.ts stays put:** `src/lib/data-sources/utils.ts` — already imported by all adapters
- **inferCategory unification:** All 5 implementations unified (openai, google, replicate, openrouter, github-trending)
- **inferModalities included:** In the same `shared/infer-category.ts` module as inferCategory
- **Keyword maps inline:** In shared module, not externalized to separate config files
- **Factory applied to 3 adapters only:** anthropic, openai, google. Replicate stays standalone.
- **Factory produces both sync() and healthCheck():** The 3 adapters have near-identical healthCheck too.
- **Zero behavior change:** All sync output must be identical before and after.

### Claude's Discretion

- Exact `KnownModelMeta` unified interface fields and which are optional
- Factory function interface design (config object vs hooks)
- How provider-specific scrape patterns and API fetch functions are injected into the factory
- Whether Replicate's KNOWN_MODELS array format gets a different `KnownModelMeta` variant or converts to the unified shape
- Internal structure of the shared `inferCategory` function
- How provider-specific quirks (OpenAI's `ALLOWED_OWNERS` filter, Anthropic's pagination, Google's `models/` prefix stripping) fit into the factory
- Adapter thinness balance: ultra-thin (~20 lines) vs moderate (~50-80 lines with custom overrides)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADAPT-01 | KNOWN_MODELS data is extracted from adapter files into shared JSON/TS data files | Exact field analysis per provider; unified interface design documented below |
| ADAPT-02 | `inferCategory()` logic uses a shared function with provider-specific keyword maps | All 5 implementations catalogued; unification approach designed |
| ADAPT-03 | `buildRecord()` pattern is a shared factory function used by all model adapters | 3 implementations compared; common output shape documented |
| ADAPT-04 | Adapter sync pipeline has a reusable `createAdapterSyncer()` factory for the static→scrape→API→upsert pattern | 3 sync() bodies compared; factory interface designed |
</phase_requirements>

---

## Summary

Phase 4 is a pure structural refactoring — zero behavior change. The work splits into four independent extractions: (1) moving KNOWN_MODELS static data out of adapter source files into dedicated data modules, (2) unifying five divergent `inferCategory()` implementations into one shared function, (3) creating a single `buildRecord()` factory that all three provider adapters call, and (4) capturing the near-identical static→scrape→API→upsert pipeline used by anthropic, openai, and google into a `createAdapterSyncer()` factory.

All the code to be refactored is contained in six files: `anthropic-models.ts` (501 lines), `openai-models.ts` (767 lines), `google-models.ts` (606 lines), `replicate.ts` (653 lines), `openrouter-models.ts` (523 lines), and `github-trending.ts` (198 lines). The shared infrastructure landing zone is a new `src/lib/data-sources/shared/` directory. No external dependencies are added; everything is standard TypeScript module extraction.

The critical design constraint is that TypeScript must remain clean (`npx tsc --noEmit`) after every change. Because the three factory-adopting adapters have provider-specific quirks (Anthropic pagination, OpenAI `ALLOWED_OWNERS` filtering, Google's `models/` prefix extraction), the factory interface must accept injected functions rather than hardcoding those behaviors.

**Primary recommendation:** Work in dependency order — data files first (no consumers changed), then `infer-category.ts` (used by all 6 adapters), then `build-record.ts` (used by 3), then `adapter-syncer.ts` (factory consuming build-record and injected API functions). Each step is independently committable with TypeScript still clean.

---

## Standard Stack

### Core (already in use — no new dependencies)

| Module | Version | Purpose | Notes |
|--------|---------|---------|-------|
| TypeScript | existing | Type-safe module extraction | `Record<string, KnownModelMeta>` pattern throughout |
| `src/lib/data-sources/utils.ts` | — | `fetchWithRetry`, `makeSlug`, `upsertBatch` | Must not be moved |
| `src/lib/data-sources/types.ts` | — | `DataSourceAdapter`, `SyncContext`, `SyncResult`, `HealthCheckResult` | Imported by all adapters and new shared modules |
| `src/lib/data-sources/registry.ts` | — | `registerAdapter()` | Each adapter file still calls this |

### No new dependencies needed

All work is internal TypeScript module reorganization. No npm packages added.

---

## Architecture Patterns

### Recommended Directory Structure (after phase)

```
src/lib/data-sources/
├── shared/
│   ├── known-models/
│   │   ├── anthropic.ts      # Record<string, KnownModelMeta> — 11 models
│   │   ├── openai.ts         # Record<string, KnownModelMeta> — ~40+ models
│   │   ├── google.ts         # Record<string, KnownModelMeta> — ~20+ models
│   │   └── replicate.ts      # KnownReplicateModel[] or Record<string, KnownModelMeta>
│   ├── infer-category.ts     # inferCategory() + inferModalities()
│   ├── build-record.ts       # buildRecord() + KnownModelMeta interface
│   └── adapter-syncer.ts     # createAdapterSyncer() factory
├── adapters/
│   ├── anthropic-models.ts   # ~60-80 lines after refactor
│   ├── openai-models.ts      # ~80-100 lines after refactor
│   ├── google-models.ts      # ~80-100 lines after refactor
│   ├── replicate.ts          # standalone, KNOWN_MODELS import only
│   ├── openrouter-models.ts  # inferCategory import only
│   ├── github-trending.ts    # inferCategory import only
│   └── [18 other adapters unchanged]
├── types.ts
├── utils.ts
├── registry.ts
└── orchestrator.ts
```

---

## Pattern 1: Unified KnownModelMeta Interface

**What:** A single superset interface in `shared/build-record.ts` that covers all fields used across all 4 providers.

**Current per-adapter interfaces compared:**

| Field | Anthropic | OpenAI | Google | Replicate (KnownModel) |
|-------|-----------|--------|--------|------------------------|
| `name` | string | string | string | string |
| `description` | string | string | string | string |
| `category` | hardcoded "multimodal" | string | string | string |
| `context_window` | number | number \| null | number \| null | — |
| `release_date` | string | string \| null | string | — |
| `architecture` | string | string \| null | string | — |
| `status` | string | string | string | — |
| `modalities` | hardcoded | string[] | string[] | — |
| `capabilities` | Record<string, boolean> | Record<string, boolean> | Record<string, boolean> | — |
| `is_open_weights` | hardcoded false | hardcoded false | boolean | boolean |
| `license` | hardcoded | hardcoded | string | — |
| `license_name` | hardcoded | hardcoded | string \| null | — |
| `parameter_count` | — | number \| null | — | — |
| `owner` | — | — | — | string |
| `run_count` | — | — | — | number |

**Recommended unified interface:**

```typescript
// Source: direct analysis of all 4 adapter KnownModelMeta definitions
export interface KnownModelMeta {
  name: string;
  description: string;
  category?: string;                          // optional — Anthropic hardcodes "multimodal"
  context_window?: number | null;
  release_date?: string | null;
  architecture?: string | null;
  status?: string;
  modalities?: string[];                      // optional — Anthropic hardcodes ["text","image"]
  capabilities?: Record<string, boolean>;
  is_open_weights?: boolean;                  // optional — Anthropic/OpenAI hardcode false
  license?: string;                           // optional — Anthropic/OpenAI hardcode "commercial"
  license_name?: string | null;
  parameter_count?: number | null;            // OpenAI only
}
```

For Replicate: the `owner` and `run_count` fields are not part of KnownModelMeta — they are Replicate-specific. The recommended approach is a separate `KnownReplicateModel` interface in `shared/known-models/replicate.ts` that has `{ owner, name, description, category, run_count, is_open_weights }`. The Replicate adapter stays standalone and its `transformKnownModel()` stays local — only the data array moves to the shared file.

---

## Pattern 2: Shared buildRecord() Factory

**What:** A single `buildRecord()` in `shared/build-record.ts` that accepts provider-level defaults and model-specific data.

**Current 3 implementations compared:**

```
anthropic buildRecord(): slug = "anthropic-{id}", provider = "Anthropic",
  category hardcoded "multimodal", is_open_weights = false, license = "commercial",
  license_name = "Proprietary", modalities hardcoded ["text","image"],
  no inferCategory/inferModalities calls

openai buildRecord(): slug = "openai-{id}", provider = "OpenAI",
  category = merged?.category ?? inferCategory(modelId),
  modalities = merged?.modalities ?? inferModalities(modelId),
  parameter_count field included

google buildRecord(): slug = "google-{id}", provider = "Google",
  category = merged?.category ?? inferCategory(modelId),
  modalities = merged?.modalities ?? inferModalities(modelId),
  is_open_weights = merged?.is_open_weights ?? false,
  license = merged?.license ?? "commercial",
  license_name = merged?.license_name ?? null
```

**Recommended factory design (config-object approach):**

```typescript
// Source: analysis of 3 buildRecord() implementations
export interface ProviderDefaults {
  provider: string;
  slugPrefix: string;                          // "anthropic", "openai", "google"
  category?: string;                           // if set, overrides inference
  modalities?: string[];                       // if set, overrides inference
  is_open_weights?: boolean;
  license?: string;
  license_name?: string | null;
  architecture?: string | null;
}

export function buildRecord(
  modelId: string,
  knownData: KnownModelMeta | undefined,
  overrides: Partial<KnownModelMeta>,
  defaults: ProviderDefaults
): Record<string, unknown> {
  const merged = { ...knownData, ...overrides };
  return {
    slug: makeSlug(`${defaults.slugPrefix}-${modelId}`),
    name: merged.name ?? modelId,
    provider: defaults.provider,
    category: defaults.category ?? merged.category ?? inferCategory(modelId, "id"),
    status: merged.status ?? "active",
    description: merged.description ?? null,
    architecture: merged.architecture ?? defaults.architecture ?? null,
    parameter_count: merged.parameter_count ?? null,
    context_window: merged.context_window ?? null,
    release_date: merged.release_date ?? null,
    is_api_available: true,
    is_open_weights: merged.is_open_weights ?? defaults.is_open_weights ?? false,
    license: merged.license ?? defaults.license ?? "commercial",
    license_name: merged.license_name ?? defaults.license_name ?? null,
    modalities: defaults.modalities ?? merged.modalities ?? inferModalities(modelId, "id"),
    capabilities: merged.capabilities ?? {},
    data_refreshed_at: new Date().toISOString(),
  };
}
```

Adapters call it with a `PROVIDER_DEFAULTS` constant defined once in each slim adapter file.

---

## Pattern 3: Shared inferCategory() + inferModalities()

**What:** All 5 `inferCategory()` implementations unified in `shared/infer-category.ts`.

**Current 5 implementations compared:**

| Adapter | Input | Strategy |
|---------|-------|----------|
| openai-models | modelId string | prefix matching (o1/o3/gpt-/dall-e/whisper/tts-/text-embedding) |
| google-models | modelId string | prefix matching (gemini/gemma/imagen/veo/embedding) |
| replicate | description string | keyword matching (long list, ~40 keywords) |
| openrouter-models | `{ input_modalities, output_modalities }` arch object | modality set logic |
| github-trending | topics string[] + description string | combined text keyword matching |

**Key design insight:** The function needs a `mode` parameter because replicate operates on description text while openai/google operate on model IDs, and openrouter operates on a structured arch object.

**Recommended approach — single function with mode dispatch:**

```typescript
// Source: analysis of all 5 inferCategory() implementations

export type InferCategoryMode = "id" | "description" | "arch" | "topics";

export interface InferCategoryOptions {
  mode: InferCategoryMode;
  // For "id" mode: the model ID string
  modelId?: string;
  // For "description" mode: the description text
  description?: string | null;
  // For "arch" mode: OpenRouter arch object
  arch?: { input_modalities?: string[]; output_modalities?: string[]; modality?: string };
  // For "topics" mode: GitHub topics array + description
  topics?: string[];
}

export function inferCategory(opts: InferCategoryOptions): string { ... }
export function inferModalities(modelId: string): string[] { ... }
```

**Keyword maps inline in the module:**

```typescript
// ID-based keyword maps (openai + google rules merged)
const ID_PREFIX_CATEGORY: Array<[string, string]> = [
  ["o1", "llm"], ["o3", "llm"], ["o4", "llm"],
  ["gpt-", "llm"],
  ["dall-e", "image_generation"],
  ["whisper", "speech_audio"],
  ["tts-", "speech_audio"],
  ["text-embedding", "embeddings"],
  ["codex", "code"],
  ["gemini", "multimodal"],
  ["gemma", "llm"],
  ["imagen", "image_generation"],
  ["veo", "video"],
];

// Description-based keyword maps (replicate rules)
const DESC_KEYWORD_CATEGORY: Array<[string[], string]> = [
  [["text-to-video", "video generation", "video synthesis", "animate"], "video"],
  [["text-to-image", "image generation", "stable diffusion", ...], "image_generation"],
  ...
];
```

**Note on openrouter:** `openrouter-models.ts` has its own local logic around `PROVIDER_NAMES`, `OPEN_WEIGHT_PROVIDERS`, `PROPRIETARY_PROVIDERS`, and `inferOpenWeights()` that are specific to OpenRouter's data model. Only `inferCategory()` moves to shared — the other helpers remain local in `openrouter-models.ts`.

---

## Pattern 4: createAdapterSyncer() Factory

**What:** Encapsulates the identical 4-step pipeline: build recordMap from KNOWN_MODELS → try scrape → try API → upsert.

**The 3 sync() bodies are structurally identical.** Differences are:
- API key env var name (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`)
- `tryFetchLiveApi()` function signature and return type (all return Map or array or null)
- `tryScrapeDocsPage()` function (different URLs, different regex patterns)
- Post-API enrichment logic (Anthropic: update display_name + createdAt; Google: update context_window; OpenAI: just stamp timestamp)

**Recommended factory interface — config-object with injected async functions:**

```typescript
// Source: analysis of all 3 sync() body implementations

export interface AdapterSyncerConfig<TApiResult> {
  /** Env var name for the API key, e.g. "ANTHROPIC_API_KEY" */
  apiKeySecret: string;
  /** Human-readable API name for metadata, e.g. "anthropic_api" */
  apiSourceName: string;
  /** All known model IDs in the static map */
  knownModelIds: string[];
  /** Build a record for this model ID (calls shared buildRecord) */
  buildRecordFn: (modelId: string, overrides?: Partial<KnownModelMeta>) => Record<string, unknown>;
  /** Count of static models (for healthCheck message) */
  staticModelCount: number;
  /** Try to scrape the public docs page. Returns [] on failure. */
  scrapeFn: (signal?: AbortSignal) => Promise<string[]>;
  /** Try to fetch live API. Returns null on failure. */
  apiFn: (apiKey: string, signal?: AbortSignal) => Promise<TApiResult | null>;
  /** Enrich recordMap with live API results */
  enrichFn: (
    recordMap: Map<string, Record<string, unknown>>,
    apiResult: TApiResult,
    now: string,
    buildRecordFn: AdapterSyncerConfig<TApiResult>["buildRecordFn"]
  ) => void;
  /** For healthCheck: the API endpoint to ping */
  healthCheckUrl: string;
  /** For healthCheck: headers to use with the API key */
  healthCheckHeaders: (apiKey: string) => Record<string, string>;
  /** For healthCheck: success message */
  healthCheckSuccessMsg: string;
}

export function createAdapterSyncer<TApiResult>(
  config: AdapterSyncerConfig<TApiResult>
): Pick<DataSourceAdapter, "sync" | "healthCheck"> { ... }
```

**How provider quirks fit:**
- **Anthropic pagination:** Handled inside `apiFn` (stays in `anthropic-models.ts` as a local `tryFetchLiveApi` passed to config)
- **OpenAI ALLOWED_OWNERS filter:** Handled inside `apiFn` (stays local)
- **Google `models/` prefix stripping:** Handled inside `apiFn` (stays local)
- **Enrichment differences:** Each adapter provides its own `enrichFn` — short (5-10 lines) that reads from `TApiResult` and updates the map

This means adapter files remain at ~60-100 lines, holding: imports, PROVIDER_DEFAULTS constant, the local `apiFn` and `scrapeFn`, the `enrichFn`, and the `createAdapterSyncer(config)` call.

---

## Anti-Patterns to Avoid

- **Duplicating data between shared file and adapter:** After extracting `known-models/anthropic.ts`, the adapter file must import it — do not leave any inline `KNOWN_MODELS` block in the adapter.
- **Barrel index.ts in shared/:** Context.md explicitly forbids this. Import each module directly.
- **Moving utils.ts:** It's already established and imported everywhere. Moving it creates churn with zero benefit.
- **Over-abstracting buildRecord():** Do not try to encode every provider default into a generic config schema. `ProviderDefaults` should be flat and obvious, not a nested abstraction.
- **Applying the factory to Replicate:** Replicate's sync is fundamentally a two-branch (static fallback OR paginated live API) pattern — not the 4-step additive pipeline. The factory would not reduce its complexity.
- **Merging inferCategory() inputs into a single type union without a mode:** Without a mode discriminant, callers cannot tell which inputs to provide and TypeScript cannot enforce correctness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug generation | Custom string transform | `makeSlug()` from `utils.ts` | Already handles all edge cases (slashes, dots, etc.) |
| Batch upsert | Manual Supabase loops | `upsertBatch()` from `utils.ts` | Already handles batch sizing, error collection |
| Fetch with retries | Custom retry logic | `fetchWithRetry()` from `utils.ts` | Already handles 429/5xx backoff |
| TypeScript path aliases | Custom resolver | `@` alias in `tsconfig.json` | Already configured and working |

**Key insight:** All the "tricky" parts of the adapter layer are already in `utils.ts`. The shared modules being created in this phase are pure data and logic — they don't need new infrastructure.

---

## Common Pitfalls

### Pitfall 1: TypeScript strict optional chaining on the unified interface
**What goes wrong:** The current Anthropic `buildRecord()` accesses `merged?.name`, `merged?.status` etc. with optional chaining because `KNOWN_MODELS[modelId]` could be undefined. The shared factory must maintain this — if `KnownModelMeta` fields are optional, the factory must guard correctly.
**Why it happens:** Extracting fields to optional makes TypeScript require narrowing at every access point.
**How to avoid:** Keep the existing `?? fallback` pattern. Use `merged?.field ?? default` throughout `buildRecord()`.
**Warning signs:** TypeScript error `Object is possibly 'undefined'` appearing in `build-record.ts`.

### Pitfall 2: Replicate's KNOWN_MODELS is an array, not a Record
**What goes wrong:** The three factory-adopting adapters use `Object.keys(KNOWN_MODELS)` to iterate. Replicate uses `KNOWN_MODELS.map(transformKnownModel)`. If you accidentally pass Replicate data to a function expecting `Record<string, KnownModelMeta>`, it will iterate over array indices.
**Why it happens:** The data format difference between `KnownModel[]` and `Record<string, KnownModelMeta>` is easy to miss when looking at the file names.
**How to avoid:** Keep Replicate's data as `KnownReplicateModel[]` (array of objects with `{ owner, name, ... }`). The shared data file just re-exports this array — it does not convert to a Record.
**Warning signs:** TypeScript error about array index being used as model ID.

### Pitfall 3: inferCategory() mode confusion
**What goes wrong:** A caller in `openai-models.ts` passes a model ID string expecting ID-mode inference, but the shared function defaults to description-mode — producing `"specialized"` for every model.
**Why it happens:** Function signature isn't explicit about which input is expected.
**How to avoid:** The `mode` parameter must be required (not defaulted) so callers are forced to declare intent. Alternatively, use overloaded signatures.
**Warning signs:** All models from OpenAI/Google API sync getting `category: "specialized"` in the database.

### Pitfall 4: healthCheck() static message references wrong count
**What goes wrong:** After extracting KNOWN_MODELS to a shared file, the healthCheck message `Static-only mode — ${Object.keys(KNOWN_MODELS).length} models available` still works because the adapter imports the shared data file — but if you accidentally hardcode the count, it will go stale.
**Why it happens:** The pattern `Object.keys(KNOWN_MODELS).length` must reference the imported object, not a cached constant.
**How to avoid:** Pass `staticModelCount` as a config value to `createAdapterSyncer()` computed at module load time from the imported data.

### Pitfall 5: Import cycle through shared/
**What goes wrong:** `shared/build-record.ts` imports from `shared/infer-category.ts`, which is fine. But if `infer-category.ts` tries to import from `build-record.ts` (for types), a circular dependency forms.
**Why it happens:** Type sharing between the two modules is tempting.
**How to avoid:** `KnownModelMeta` lives in `build-record.ts`. `infer-category.ts` accepts primitive inputs (string, object) only — no KnownModelMeta dependency.

### Pitfall 6: Google's meta.contextWindow update logic
**What goes wrong:** The Google sync has a unique "enrich known model if API provides a fresher context window" step that the other two adapters don't have. This is inside the enrichFn. If it's accidentally omitted from the factory config, Google's context_window field won't update from live API.
**Why it happens:** This is easy to miss because it's a non-additive update (modifying existing map entries vs. adding new ones).
**How to avoid:** Document the Google enrichFn explicitly in the plan with this logic preserved.

---

## Code Examples

### Known models data file (anthropic example)

```typescript
// Source: direct extraction from src/lib/data-sources/adapters/anthropic-models.ts
// File: src/lib/data-sources/shared/known-models/anthropic.ts
import type { KnownModelMeta } from "../build-record";

export const ANTHROPIC_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "claude-opus-4-6": {
    name: "Claude Opus 4.6",
    description: "...",
    context_window: 200000,
    release_date: "2025-12-12",
    architecture: "Transformer",
    status: "active",
    capabilities: { vision: true, tool_use: true, extended_thinking: true, ... },
  },
  // ... remaining 10 models
};
```

### Slim adapter after full refactor (anthropic example sketch)

```typescript
// File: src/lib/data-sources/adapters/anthropic-models.ts
import type { DataSourceAdapter, SyncContext, SyncResult, HealthCheckResult } from "../types";
import { registerAdapter } from "../registry";
import { ANTHROPIC_KNOWN_MODELS } from "../shared/known-models/anthropic";
import { buildRecord, type ProviderDefaults } from "../shared/build-record";
import { createAdapterSyncer } from "../shared/adapter-syncer";
import { fetchWithRetry } from "../utils";

const PROVIDER_DEFAULTS: ProviderDefaults = {
  provider: "Anthropic",
  slugPrefix: "anthropic",
  category: "multimodal",         // All Claude models are multimodal — no inference needed
  modalities: ["text", "image"],  // All Claude models have these modalities
  is_open_weights: false,
  license: "commercial",
  license_name: "Proprietary",
};

const boundBuildRecord = (modelId: string, overrides = {}) =>
  buildRecord(modelId, ANTHROPIC_KNOWN_MODELS[modelId], overrides, PROVIDER_DEFAULTS);

// Provider-specific API fetch (pagination logic stays local)
async function tryFetchLiveApi(...) { ... }  // ~25 lines, unchanged

// Provider-specific scrape (stays local)
async function tryScrapeDocsPage(...) { ... }  // ~20 lines, unchanged

const { sync, healthCheck } = createAdapterSyncer({
  apiKeySecret: "ANTHROPIC_API_KEY",
  apiSourceName: "anthropic_api",
  knownModelIds: Object.keys(ANTHROPIC_KNOWN_MODELS),
  buildRecordFn: boundBuildRecord,
  staticModelCount: Object.keys(ANTHROPIC_KNOWN_MODELS).length,
  scrapeFn: tryScrapeDocsPage,
  apiFn: tryFetchLiveApi,
  enrichFn: (recordMap, apiModels, now, build) => {
    for (const [modelId, meta] of apiModels) {
      if (!recordMap.has(modelId)) {
        recordMap.set(modelId, build(modelId, {
          name: meta.displayName || undefined,
          release_date: meta.createdAt ? meta.createdAt.split("T")[0] : undefined,
        }));
      }
      const existing = recordMap.get(modelId);
      if (existing) existing.data_refreshed_at = now;
    }
  },
  healthCheckUrl: "https://api.anthropic.com/v1/models?limit=1",
  healthCheckHeaders: (apiKey) => ({
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }),
  healthCheckSuccessMsg: "Anthropic /v1/models API reachable",
});

const adapter: DataSourceAdapter = {
  id: "anthropic-models",
  name: "Anthropic Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: [],
  sync,
  healthCheck,
};

registerAdapter(adapter);
export default adapter;
```

### inferCategory() — unified function sketch

```typescript
// File: src/lib/data-sources/shared/infer-category.ts
// Covers: openai (id-mode), google (id-mode), replicate (description-mode),
//         openrouter (arch-mode), github-trending (topics-mode)

export function inferCategory(opts: InferCategoryOptions): string {
  switch (opts.mode) {
    case "id": {
      const id = (opts.modelId ?? "").toLowerCase();
      for (const [prefix, category] of ID_PREFIX_CATEGORY) {
        if (id.startsWith(prefix) || (prefix.includes(".") && id.includes(prefix))) {
          return category;
        }
      }
      return "specialized";
    }
    case "description": {
      const desc = (opts.description ?? "").toLowerCase();
      for (const [keywords, category] of DESC_KEYWORD_CATEGORY) {
        if (keywords.some(kw => desc.includes(kw))) return category;
      }
      return "specialized";
    }
    case "arch": {
      const outputs = new Set(opts.arch?.output_modalities ?? []);
      const inputs = new Set(opts.arch?.input_modalities ?? []);
      if (outputs.has("image")) return "image_generation";
      if (outputs.has("video")) return "video";
      if (outputs.has("audio")) return "speech_audio";
      if ((inputs.has("image") || inputs.has("video") || inputs.has("audio")) && outputs.has("text")) {
        return "multimodal";
      }
      return "llm";
    }
    case "topics": {
      const text = `${(opts.topics ?? []).join(" ")} ${opts.description ?? ""}`.toLowerCase();
      for (const [keywords, category] of TOPICS_KEYWORD_CATEGORY) {
        if (keywords.some(kw => text.includes(kw))) return category;
      }
      return "specialized";
    }
  }
}
```

---

## Duplication Inventory (complete)

### What moves where

| Duplication | Lines | From | To | Effort |
|-------------|-------|------|----|--------|
| Anthropic KNOWN_MODELS | ~186 lines | anthropic-models.ts | shared/known-models/anthropic.ts | Lift-and-shift |
| OpenAI KNOWN_MODELS | ~450 lines | openai-models.ts | shared/known-models/openai.ts | Lift-and-shift |
| Google KNOWN_MODELS | ~265 lines | google-models.ts | shared/known-models/google.ts | Lift-and-shift |
| Replicate KNOWN_MODELS | ~245 lines | replicate.ts | shared/known-models/replicate.ts | Lift-and-shift |
| KnownModelMeta interface | 4 definitions | all 4 adapters | shared/build-record.ts | Merge + optional fields |
| openai inferCategory() | ~12 lines | openai-models.ts | shared/infer-category.ts | Merge into switch |
| google inferCategory() | ~7 lines | google-models.ts | shared/infer-category.ts | Merge into switch |
| replicate inferCategory() | ~40 lines | replicate.ts | shared/infer-category.ts | Merge into switch |
| openrouter inferCategory() | ~12 lines | openrouter-models.ts | shared/infer-category.ts | Merge into switch |
| github inferCategory() | ~12 lines | github-trending.ts | shared/infer-category.ts | Merge into switch |
| openai inferModalities() | ~8 lines | openai-models.ts | shared/infer-category.ts | Merge |
| google inferModalities() | ~8 lines | google-models.ts | shared/infer-category.ts | Merge |
| anthropic buildRecord() | ~22 lines | anthropic-models.ts | shared/build-record.ts | Generalize |
| openai buildRecord() | ~22 lines | openai-models.ts | shared/build-record.ts | Generalize |
| google buildRecord() | ~22 lines | google-models.ts | shared/build-record.ts | Generalize |
| anthropic sync() pipeline | ~50 lines | anthropic-models.ts | shared/adapter-syncer.ts | Parameterize |
| openai sync() pipeline | ~50 lines | openai-models.ts | shared/adapter-syncer.ts | Parameterize |
| google sync() pipeline | ~55 lines | google-models.ts | shared/adapter-syncer.ts | Parameterize |
| anthropic healthCheck() | ~25 lines | anthropic-models.ts | shared/adapter-syncer.ts | Parameterize |
| openai healthCheck() | ~22 lines | openai-models.ts | shared/adapter-syncer.ts | Parameterize |
| google healthCheck() | ~22 lines | google-models.ts | shared/adapter-syncer.ts | Parameterize |

**Total duplication removed:** ~1500+ lines → ~4 shared modules totaling ~250-300 lines, plus slim adapter files

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Inline `KnownModelMeta` interface in each adapter | Single `KnownModelMeta` in `shared/build-record.ts` | Field additions require one change, not four |
| `KNOWN_MODELS` embedded in adapter source | Separate `shared/known-models/*.ts` data files | Data files can be updated without touching pipeline logic |
| 5 separate `inferCategory()` functions | 1 function with mode-based dispatch | New category rules added once |
| 3 near-identical `sync()` / `healthCheck()` bodies | `createAdapterSyncer()` factory | Bug fixes in pipeline apply to all 3 providers |

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/data-sources/shared` |
| Full suite command | `npm test` |
| TypeScript check | `npx tsc --noEmit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADAPT-01 | KNOWN_MODELS data lives in shared files, not in adapter source | unit | `npx vitest run src/lib/data-sources/shared/known-models` | ❌ Wave 0 |
| ADAPT-02 | `inferCategory()` returns correct category for each mode | unit | `npx vitest run src/lib/data-sources/shared/infer-category.test.ts` | ❌ Wave 0 |
| ADAPT-03 | `buildRecord()` produces correct DB shape for each provider | unit | `npx vitest run src/lib/data-sources/shared/build-record.test.ts` | ❌ Wave 0 |
| ADAPT-04 | Factory-produced `sync()` has same output shape as original | unit | `npx vitest run src/lib/data-sources/shared/adapter-syncer.test.ts` | ❌ Wave 0 |
| All | TypeScript compiles clean after all changes | type check | `npx tsc --noEmit` | n/a |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (fast, catches type errors immediately)
- **Per wave merge:** `npm test` (full Vitest suite)
- **Phase gate:** `npx tsc --noEmit` + `npm test` both green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/data-sources/shared/infer-category.test.ts` — covers ADAPT-02, tests all 5 modes
- [ ] `src/lib/data-sources/shared/build-record.test.ts` — covers ADAPT-03, tests each provider's defaults
- [ ] `src/lib/data-sources/shared/adapter-syncer.test.ts` — covers ADAPT-04, mocks scrapeFn/apiFn

Note: ADAPT-01 (data file extraction) is verified by TypeScript compilation and the fact that adapter files no longer contain inline KNOWN_MODELS — structural verification, not runtime test.

---

## Open Questions

1. **Replicate's `transformKnownModel()` vs unified `buildRecord()`**
   - What we know: Replicate has a separate `transformKnownModel()` for its static path and `transformModel()` for live API results. Its output shape differs (uses `hf_downloads` for run_count, no `architecture` field, empty `modalities: []`).
   - What's unclear: Whether it's worth unifying Replicate's `transformKnownModel()` with the shared `buildRecord()` (requires adding run_count/owner awareness to the shared factory) or leaving it local.
   - Recommendation: Leave Replicate's `transformKnownModel()` local. Move only the data array. The output shape difference makes unification add complexity rather than reduce it.

2. **OpenRouter's `inferCategory()` uses structured arch object — not a string**
   - What we know: OpenRouter's `inferCategory()` takes `{ input_modalities, output_modalities }` — completely different input than the other 4.
   - What's unclear: Whether to add "arch" mode to the unified function (brings OpenRouter into the shared module) or leave it local (simpler but leaves one implementation out).
   - Recommendation: Add the "arch" mode to the unified function — it eliminates all 5 implementations and the function is clear with mode dispatch. The arch logic is ~10 lines.

---

## Sources

### Primary (HIGH confidence)

- Direct code analysis: `src/lib/data-sources/adapters/anthropic-models.ts` (501 lines) — complete read
- Direct code analysis: `src/lib/data-sources/adapters/openai-models.ts` (767 lines) — complete read
- Direct code analysis: `src/lib/data-sources/adapters/google-models.ts` (606 lines) — complete read
- Direct code analysis: `src/lib/data-sources/adapters/replicate.ts` (653 lines) — complete read
- Direct code analysis: `src/lib/data-sources/adapters/openrouter-models.ts` (523 lines) — complete read
- Direct code analysis: `src/lib/data-sources/adapters/github-trending.ts` (198 lines) — complete read
- Direct code analysis: `src/lib/data-sources/types.ts` — `DataSourceAdapter` interface
- Direct code analysis: `src/lib/data-sources/utils.ts` — shared utility functions
- `.planning/phases/04-adapter-deduplication/04-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — ADAPT-01 through ADAPT-04 definitions
- `vitest.config.ts` — test configuration (Vitest 4.0.18, `src/**/*.test.ts` include pattern)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all code directly read from source; no external dependencies added
- Architecture patterns: HIGH — all patterns derived from reading actual implementation code
- Pitfalls: HIGH — pitfalls identified from concrete differences observed across implementations
- Validation: HIGH — Vitest config confirmed, framework version confirmed from package.json

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase — changes only when adapters are modified)
