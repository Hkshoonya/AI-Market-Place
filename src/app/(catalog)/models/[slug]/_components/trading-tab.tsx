import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TradingChart } from "@/components/charts/trading-chart";
import { formatNumber } from "@/lib/format";

export interface TradingTabProps {
  modelSlug: string;
  popularity_rank: number | null;
  market_cap_estimate: number | null;
  agent_score: number | null;
  github_stars: number | null;
}

export function TradingTab({
  modelSlug,
  popularity_rank,
  market_cap_estimate,
  agent_score,
  github_stars,
}: TradingTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Popularity &amp; Market Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <TradingChart modelSlug={modelSlug} />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {popularity_rank ? `#${popularity_rank}` : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Popularity Rank</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {market_cap_estimate
                ? `$${(Number(market_cap_estimate) / 1_000_000).toFixed(1)}M`
                : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Est. Market Cap</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {agent_score ? Number(agent_score).toFixed(1) : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">Agent Score</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">
              {github_stars ? formatNumber(github_stars) : "---"}
            </p>
            <p className="text-[11px] text-muted-foreground">GitHub Stars</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
