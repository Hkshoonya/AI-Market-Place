import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TradingChart } from "@/components/charts/trading-chart";
import { formatNumber } from "@/lib/format";

export interface TradingTabProps {
  modelSlug: string;
  popularity_rank: number | null;
  adoption_score: number | null;
  economic_footprint_score: number | null;
  market_cap_estimate: number | null;
  agent_score: number | null;
  github_stars: number | null;
}

export function TradingTab({
  modelSlug,
  popularity_rank,
  adoption_score,
  economic_footprint_score,
  market_cap_estimate,
  agent_score,
  github_stars,
}: TradingTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Popularity &amp; Economic Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <TradingChart modelSlug={modelSlug} defaultMetric="economic_footprint_score" />
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
              {economic_footprint_score != null ? Number(economic_footprint_score).toFixed(1) : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Economic Footprint</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {market_cap_estimate != null
                ? `$${(Number(market_cap_estimate) / 1_000_000).toFixed(1)}M`
                : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Est. Market Cap</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {agent_score != null ? Number(agent_score).toFixed(1) : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Agent Score</p>
          </div>
        </div>
        <div className="mt-3 text-center text-[11px] text-muted-foreground">
          {github_stars ? `GitHub Stars: ${formatNumber(github_stars)}` : "GitHub Stars unavailable"}
        </div>
      </CardContent>
    </Card>
  );
}
