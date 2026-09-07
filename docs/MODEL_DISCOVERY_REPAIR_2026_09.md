# September 2026 Model Discovery Repair

## Production Findings

Read-only inspection on 2026-09-07 found that the scheduled OpenAI and Anthropic
sources were running, not stopped. GPT-6 Astra and Fable 5.1 already existed.
However, competing writers replaced useful metadata, Fable 5.1 inherited Fable
5's June release date/name, and missing-from-feed cleanup archived valid models
seen by other sources. The 04:02 UTC provider jobs reported success while
archiving 50 OpenAI and 16 Anthropic records. Missing from an account-scoped API
list is not proof of provider retirement.

## Changes

- Numeric subversions no longer qualify as harmless family variants. A stale
  display name cannot override the version in the stable slug.
- ID-only discovery preserves existing mandatory name/category and omits empty
  optional fields instead of erasing richer cross-source metadata. Required
  fields remain in upserts because PostgreSQL checks NOT NULL before conflict
  resolution. Existing-identity lookup failure blocks writes safely.
- Archival requires an explicit invalid-row predicate and a successful live
  discovery/write phase. Valid missing models are retained. Static-only fallback
  is reported as degraded rather than current.
- Newly discovered OpenAI/Anthropic IDs can acquire names, context limits and
  explicit release dates from first-party Markdown model references. Fetches
  use fixed origins, no redirects, exact document/model identity matching,
  six requests per provider run, four-second timeouts and 256 KB body limits.
  Parser failures retain the ID without inventing metadata. This is bounded
  enrichment, not a guarantee that every provider page/schema is supported.
- Added verified Astra, Fable 5.1 and restricted Mythos 5.1 fallbacks, Astra's
  official recurring price check, and Fable/Mythos 5.1 cache pricing. API object
  creation timestamps are no longer used as public launch dates. No benchmark
  score or open-weight availability was fabricated.

## Verification And Release

Regression tests reproduce the Fable version collision, cover future versions,
metadata preservation, missing-feed archival, degraded discovery, reference
parser bounds, and unscored recent releases on the homepage. The unit suite,
component suite, repository CI typecheck and lint passed locally. A read-only
adapter run against live feeds produced Astra (2026-09-03), Fable 5.1 and Mythos
5.1 (2026-09-01) with no archival candidates and correct closed-weight flags.

This change is separate from Data API billing PR #38. It does not activate
payments or apply billing migration 099. Follow normal code-owner review and
CI; no administrator bypass is authorized. After deployment, run OpenRouter,
the two provider adapters and official pricing through the normal scheduler,
then verify canonical rows, latest-release cards and the next scheduled cycle.
No production data was mutated during this investigation, so live corrections
must not be claimed until the reviewed fix deploys and syncs successfully.

## Primary References

- [OpenAI API changelog](https://developers.openai.com/api/docs/changelog): Astra
  release on September 3, 2026.
- [GPT-6 Astra reference](https://developers.openai.com/api/docs/models/gpt-6-astra):
  context, modalities, capabilities and standard pricing.
- [Fable 5.1 reference](https://platform.claude.com/docs/en/models/fable-5-1/overview):
  release, context, access and cache pricing.
- [Fable/Mythos announcement](https://www.anthropic.com/claude-fable-and-mythos-5-1):
  availability, safeguards, data-retention changes and restricted Mythos access.
