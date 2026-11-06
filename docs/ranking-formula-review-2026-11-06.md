# Ranking formula review: 2026-11-06

## Findings and corrections

- The Arena adapter used a third-party mirror last modified July 18, 2025 and
  stamped every import with today's date. It now reads Arena's official
  `lmarena-ai/leaderboard-dataset`, filters to `text/latest/overall`, validates
  publication dates and uses a distinct `arena-text-official` identity. Frozen
  mirror rows remain stored as history but cannot supply current ranking inputs.
  The official filtered endpoint returned 419 overall text rows on November 6,
  with a publication date of October 28. This is not the unrelated agent IPS
  leaderboard and its scores must not be imported as Elo ratings.
- Performance matching now disables partial-name and dated-family expansion for
  Arena imports. Unmatched effort/version variants are reported, not attached to
  a nearby older model. Updates use batches of 100 and retain the publication
  date as the snapshot key, avoiding a new history row on every daily import.
- Scoring previously selected the greatest historical Arena rating for each model,
  including across arenas. It now selects the latest dated result from the text
  arena, with vision-understanding evidence for vision models and as a multimodal
  fallback. Unknown arenas and invalid/future snapshots are excluded.
- The old 800-1400 rating scale flattened current frontier results. Its upper
  bound now extends to the maximum **latest** rating in the same arena, never an
  all-time peak or a maximum pooled across different arenas. This is a relative
  score, not a probability, and its calibration can change with the cohort.
- The recency implementation used `exp(-age / halfLife)`, which is not a half-life.
  It now uses `2 ** (-age / halfLife)`. Capability and expert retain a 12-month
  half-life; quality retains 18 months. Months are defined as 30 days. Future dates
  cannot exceed 100; invalid dates receive the existing neutral value of 50.
- Structured benchmark provenance is enforced at the result level, using the
  existing trusted-source allowlist. The definition's source cannot establish a
  result's provenance. Null, non-finite, out-of-range and untrusted/seed results do
  not enter scoring or source-coverage multipliers. A true zero remains evidence.
- Repeated reports of a benchmark are averaged once per normalized benchmark slug
  rather than counting as additional test breadth. Distinct benchmark versions
  remain separate. Arena Elo stored as a benchmark is excluded to avoid counting
  the same kind of evidence twice.
- SWE-bench Verified/Pro and Terminal-Bench 2/2.1/3/4 receive primary coding/agent
  treatment in the applicable categories. This does not equate their difficulty
  or rewrite their benchmark identifiers. No release receives points just because
  of a larger model version number.

## Weights retained

Capability remains 60% category-weighted benchmarks, 30% normalized Arena rating
and 10% recency. Missing benchmark/Arena weight transfers to the other available
performance signal; with neither, capability remains null. Existing sparse-evidence,
corroboration and lifecycle adjustments remain in place.

Balanced ranking remains a rank blend, not a capability score: for LLM/multimodal,
35% capability, 30% usage, 25% expert, 10% value; coding/agents use 40/25/25/10;
image generation uses 20/40/30/10. Existing bounded lifecycle penalties and
deterministic tie-breaking remain. The homepage is a commercial/discovery
shortlist with provider diversity and launch/access checks, not the pure
capability leaderboard. Affiliate commissions are not scoring inputs.

## Read-only production preview

At 15:38 UTC, a bounded 57-model sample found 162 active model/arena pairs whose
latest result was below their historical peak and 23 latest ratings above 1400.
Nine benchmark reports in the shortlist failed the new evidence rules. The
initial preview changed capability scores in both directions. These stored text
ratings were subsequently identified as legacy mirror inputs, so their database
snapshot timestamps must not be interpreted as current upstream measurements.
The final code excludes them pending official-source import. This audit does not
compute global rank ordering or validate the identity of every catalog entry.

Run with the existing environment loaded, without printing secrets:

```bash
node --env-file=.env.local --import tsx scripts/audit-ranking-formulas.ts
```

The audit uses the management API's `read_only: true`, a fixed query, a bounded
shortlist and a timeout. It never invokes the full scoring orchestrator, whose
pricing-sync stage writes data. No production recomputation or migration is part
of this audit. Rollout must import official Arena ratings before running the
corrected scoring job. Confirm exact identity matches and unmatched variants,
then preview and recompute through the normal jobs while database health is
stable. A rollout guard halts scoring before any writes if legacy text ratings
exist but no official text evidence has been imported. Do not force a full recalculation
during a database outage.

## Limitations and follow-up

Normalized raw percentages from different tests are not equal-difficulty measures.
Agent/harness settings and benchmark versions matter. The source allowlist alone
cannot prove every upstream attribution or detect all fractional-vs-percentage
normalization mistakes. Retain original evidence and verify suspicious reports
rather than guessing a factor of 100. Vision Arena's latest stored snapshot was
October 12, so its ingestion/freshness needs separate repair; this review does not
claim that feed is current. The official Hugging Face filter endpoint also
returned intermittent upstream HTTP 500/authentication-check timeouts during
verification; the source must pass a fresh live check before rollout. The
adapter fails closed with bounded timeouts, not a stale-mirror fallback.
Fetching historical Arena rows remains a
database-load concern: a reviewed latest-per-model/arena query or RPC should
replace it, but no unapproved database migration is introduced here.

Primary references checked November 6:

- [Arena dataset and methodology](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset)
- [SWE-bench Verified and harness comparability](https://www.swebench.com/verified)
- [Terminal-Bench benchmark versions](https://www.tbench.ai/benchmarks)
