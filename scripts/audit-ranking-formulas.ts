import { selectArenaEvidence, type ArenaSnapshot } from "@/lib/compute-scores/arena-evidence";
import { computeCapabilityScore } from "@/lib/scoring/capability-calculator";
import { computeCapabilityScoreMultiplier } from "@/lib/compute-scores/ranking-penalties";
import { isTrustedStructuredBenchmarkSource } from "@/lib/models/benchmark-score-trust";
import { buildSourceCoverage } from "@/lib/source-coverage";

// Read-only, bounded shortlist audit. Never invokes computeAllLenses (which writes pricing).
const QUERY = `with candidates as (
  (select id from public.models where status='active' and capability_rank is not null order by capability_rank, id limit 25)
  union
  (select id from public.models where status='active' and overall_rank is not null order by overall_rank, id limit 25)
  union
  (select id from public.models where status='active' and provider in ('OpenAI','Anthropic','Google') order by release_date desc nulls last, id limit 15)
), latest_arena as (
  select distinct on(e.model_id,e.arena_name) e.model_id,e.arena_name,e.elo_score,e.snapshot_date,m.category,
    max(e.elo_score) over(partition by e.model_id,e.arena_name) as historical_peak
  from public.elo_ratings e join public.models m on m.id=e.model_id
  where m.status='active' and e.snapshot_date <= current_date
  order by e.model_id,e.arena_name,e.snapshot_date desc,e.elo_score
)
select
  (select jsonb_agg(to_jsonb(m)) from (
    select m.id,m.name,m.slug,m.provider,m.category,m.status,m.description,m.short_description,m.release_date,
      m.is_open_weights,m.is_api_available,m.capability_score,m.capability_rank,m.overall_rank
    from public.models m join candidates c on c.id=m.id
  ) m) as models,
  (select jsonb_agg(to_jsonb(s)) from (
    select s.model_id,s.score_normalized,s.source,b.slug,b.category
    from public.benchmark_scores s join candidates c on c.id=s.model_id join public.benchmarks b on b.id=s.benchmark_id
  ) s) as benchmarks,
  (select jsonb_agg(to_jsonb(e)) from latest_arena e) as arena`;

type Model = { id: string; name: string; slug: string; provider: string; category: string;
  status: string; description: string | null; short_description: string | null;
  release_date: string | null; is_open_weights: boolean; is_api_available: boolean;
  capability_score: number | string | null; capability_rank: number | null; overall_rank: number | null };
type Benchmark = { model_id: string; score_normalized: number | string | null;
  source: string | null; slug: string; category: string | null };
type Evidence = { models: Model[]; benchmarks: Benchmark[];
  arena: Array<ArenaSnapshot & { category: string; historical_peak: number }> };

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !url) throw new Error("Load the local environment file before running this read-only audit.");
  const ref = new URL(url).hostname.split(".")[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, read_only: true }), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Read-only audit failed (HTTP ${response.status}); no writes attempted.`); }
  const [evidence] = await response.json() as Evidence[];
  const models = evidence.models ?? [];
  const arenaRows = evidence.arena ?? [];
  const arena = selectArenaEvidence(arenaRows, [...models, ...arenaRows.map((row) => ({ id: row.model_id, category: row.category }))]);
  let excluded = 0;
  let duplicateReports = 0;
  const results = models.map((model) => {
    const reports = (evidence.benchmarks ?? []).filter((row) => row.model_id === model.id);
    const accepted = reports.filter((row) => {
      const score = row.score_normalized == null ? NaN : Number(row.score_normalized);
      const valid = isTrustedStructuredBenchmarkSource(row.source) && Number.isFinite(score)
        && score >= 0 && score <= 100 && row.slug.replace(/_/g, "-") !== "chatbot-arena-elo";
      if (!valid) excluded++;
      return valid;
    });
    const groups = new Map<string, number[]>();
    for (const row of accepted) {
      const slug = row.slug.toLowerCase().replace(/_/g, "-");
      groups.set(slug, [...(groups.get(slug) ?? []), Number(row.score_normalized)]);
    }
    duplicateReports += accepted.length - groups.size;
    const benchmarkScores = [...groups].map(([slug, scores]) => ({ slug, score: scores.reduce((a,b) => a+b, 0) / scores.length }));
    const score = computeCapabilityScore({ benchmarkScores, category: model.category,
      eloScore: arena.eloMap.get(model.id) ?? null, eloNormalized: arena.eloNormalizedMap.get(model.id),
      releaseDate: model.release_date, sourceCoverage: buildSourceCoverage({
        benchmarkSources: accepted.flatMap((row) => row.source ? [row.source] : []),
        benchmarkCategories: accepted.flatMap((row) => row.category ? [row.category] : []),
        eloSources: arena.eloSourcesByModel.get(model.id) ?? [], newsSources: [], pricingSources: [], hasCommunitySignals: false,
      }),
    });
    const proposed = score == null ? null : Math.round(score * computeCapabilityScoreMultiplier(model) * 10) / 10;
    return { name: model.name, slug: model.slug, publishedRank: model.capability_rank,
      published: model.capability_score == null ? null : Number(model.capability_score), proposed,
      benchmarks: groups.size, arenaRating: arena.eloMap.get(model.id) ?? null };
  });
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true, shortlistCount: models.length,
    historicalPeaksDifferentFromLatest: arenaRows.filter((row) => row.historical_peak > row.elo_score).length,
    latestRatingsAboveOldCeiling: arenaRows.filter((row) => row.elo_score > 1400).length,
    officialTextEvidencePairs: arenaRows.filter((row) => row.arena_name === "arena-text-official").length,
    excludedBenchmarkReports: excluded, duplicateReportsCollapsed: duplicateReports,
    note: "Capability-only preview; legacy mirror ratings are excluded. Import official evidence before rollout. Not a recomputed global ordering or a recommendation to promote new model names.",
    results: results.sort((a,b) => (b.proposed ?? -1) - (a.proposed ?? -1)),
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Read-only ranking audit failed.");
  process.exitCode = 1;
});
