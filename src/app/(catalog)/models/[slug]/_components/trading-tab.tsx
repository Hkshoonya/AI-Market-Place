import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TradingChart } from "@/components/charts/trading-chart";
import {
  buildMarketValueThesis,
  formatMarketValue,
  renderStars,
} from "@/lib/models/market-value";

export interface TradingTabProps {
  modelSlug: string;
  popularity_rank: number | null;
  popularity_score: number | null;
  adoption_score: number | null;
  economic_footprint_score: number | null;
  market_cap_estimate: number | null;
  capability_score: number | null;
  agent_score: number | null;
  github_stars: number | null;
  benchmark_count: number;
  arena_family_count: number;
  pricing_source_count: number;
}

export function TradingTab({
  modelSlug,
  popularity_rank,
  popularity_score,
  adoption_score,
  economic_footprint_score,
  market_cap_estimate,
  capability_score,
  agent_score,
  github_stars,
  benchmark_count,
  arena_family_count,
  pricing_source_count,
}: TradingTabProps) {
  const thesis = buildMarketValueThesis({
    popularityScore: popularity_score,
    adoptionScore: adoption_score,
    economicFootprintScore: economic_footprint_score,
    capabilityScore: capability_score,
    agentScore: agent_score,
    benchmarkCount: benchmark_count,
    arenaFamilyCount: arena_family_count,
    pricingSourceCount: pricing_source_count,
  });

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Market Value &amp; Economic Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <TradingChart modelSlug={modelSlug} defaultMetric="popularity_score" />

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {popularity_rank ? `#${popularity_rank}` : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Popularity Rank</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {adoption_score != null ? Number(adoption_score).toFixed(1) : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Adoption Score</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {economic_footprint_score != null
                ? Number(economic_footprint_score).toFixed(1)
                : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Economic Footprint</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {formatMarketValue(market_cap_estimate)}
            </p>
            <p className="text-[11px] text-muted-foreground">Est. Market Value</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {agent_score != null ? Number(agent_score).toFixed(1) : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Agent Score</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border/50 bg-card/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neon/80">
            Market Value Thesis
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{thesis.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {thesis.pillars.map((pillar) => (
              <div
                key={pillar.label}
                className="rounded-lg border border-border/40 bg-secondary/20 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{pillar.label}</span>
                  <span className="font-mono text-sm text-[#f5a623]">
                    {renderStars(pillar.stars)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 text-center text-[11px] text-muted-foreground">
          {github_stars
            ? `GitHub Stars: ${github_stars.toLocaleString()}`
            : "GitHub Stars unavailable"}
        </div>
      </CardContent>
    </Card>
  );
}
