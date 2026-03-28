import { Swords, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BenchmarkRadar } from "@/components/charts/benchmark-radar";
import { formatNumber } from "@/lib/format";
import { collapseArenaRatings } from "@/lib/models/arena-family";
import type { LaunchRadarItem } from "@/lib/news/presentation";

export interface BenchmarkScore {
  score?: number | null;
  score_normalized?: number | null;
  benchmarks?: {
    name?: string;
    slug?: string;
    category?: string;
    max_score?: number | null;
  } | null;
  [key: string]: unknown;
}

export interface EloRating {
  arena_name: string;
  elo_score: number;
  rank?: number | null;
  confidence_interval_low?: number | null;
  confidence_interval_high?: number | null;
  num_battles?: number | null;
  snapshot_date?: string | null;
}

export interface BenchmarksTabProps {
  benchmarkScores: BenchmarkScore[];
  eloRatings: EloRating[];
  recentBenchmarkEvidence?: LaunchRadarItem[];
}

export function BenchmarksTab({
  benchmarkScores,
  eloRatings,
  recentBenchmarkEvidence = [],
}: BenchmarksTabProps) {
  const currentArenaRatings = collapseArenaRatings(eloRatings);
  const hasNormalizedBenchmarks = benchmarkScores.length > 0;
  const hasBenchmarkEvidence = recentBenchmarkEvidence.length > 0;

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Benchmark Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {hasNormalizedBenchmarks ? (
            <>
              <div className="mb-8">
                <BenchmarkRadar
                  scores={benchmarkScores.map((benchmarkScore) => ({
                    benchmark: benchmarkScore.benchmarks?.name ?? "Unknown",
                    score: Number(
                      benchmarkScore.score_normalized ?? benchmarkScore.score
                    ),
                    maxScore: 100,
                  }))}
                />
              </div>
              <div className="space-y-4">
                {benchmarkScores.map((benchmarkScore, index) => {
                  const score = Number(
                    benchmarkScore.score_normalized ?? benchmarkScore.score
                  );

                  return (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <span className="text-sm font-medium">
                          {benchmarkScore.benchmarks?.name ?? "Unknown"}
                        </span>
                        <span className="ml-2 text-[10px] capitalize text-muted-foreground">
                          {benchmarkScore.benchmarks?.category ?? ""}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="relative h-3 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="animate-score-bar h-full rounded-full bg-gradient-to-r from-neon/70 to-neon"
                            style={{
                              width: `${Math.min((score / 100) * 100, 100)}%`,
                              animationDelay: `${index * 80}ms`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="w-14 text-right text-sm font-bold tabular-nums">
                        {score.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Normalized benchmark suite coverage has not landed for this model yet.
              </p>
              {hasBenchmarkEvidence ? (
                <p className="text-xs text-muted-foreground">
                  Recent benchmark evidence is already available below, so this release
                  is being tracked even while structured score rows catch up.
                </p>
              ) : currentArenaRatings.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Arena evidence is already available below, so the model still has live
                  competitive signal even while the benchmark table catches up.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This usually means upstream benchmark datasets have not published a
                  stable row for this release yet.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {hasBenchmarkEvidence && (
        <Card className="mt-6 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Recent Benchmark Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentBenchmarkEvidence.map((item, index) => (
                <div
                  key={item.id ?? item.url ?? `${item.title}-${index}`}
                  className="rounded-lg border border-border/50 p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium leading-5">
                        {item.title ?? "Benchmark update"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {item.signalLabel}
                        </Badge>
                        {item.source ? <span>{item.source}</span> : null}
                        {item.published_at ? (
                          <span>
                            {new Date(item.published_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {item.summary ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {item.summary}
                    </p>
                  ) : null}
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-xs font-medium text-neon hover:underline"
                    >
                      View source
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {currentArenaRatings.length > 0 && (
        <Card className="mt-6 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Swords className="h-5 w-5 text-neon" />
              Arena ELO Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentArenaRatings.map((rating, index) => {
                const ciLow = rating.confidence_interval_low;
                const ciHigh = rating.confidence_interval_high;
                const ciWidth = ciLow && ciHigh ? ciHigh - ciLow : null;

                return (
                  <div key={index} className="rounded-lg border border-border/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-[#f5a623]" />
                        <span className="text-sm font-medium">{rating.displayName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rating.variantCount > 1 && (
                          <Badge variant="outline" className="text-[10px]">
                            {rating.variantCount} snapshots
                          </Badge>
                        )}
                        {rating.rank && (
                          <Badge className="bg-neon/10 text-xs text-neon">
                            Arena Rank #{rating.rank}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {rating.elo_score}
                        </p>
                        <p className="text-[11px] text-muted-foreground">ELO Score</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium tabular-nums">
                          {ciLow && ciHigh ? `${ciLow} - ${ciHigh}` : "--"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">95% Confidence</p>
                        {ciWidth != null && (
                          <p className="text-[10px] text-muted-foreground/60">
                            +/-{(ciWidth / 2).toFixed(0)} points
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium tabular-nums">
                          {rating.num_battles ? formatNumber(rating.num_battles) : "--"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Battles</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium tabular-nums">
                          {rating.snapshot_date
                            ? new Date(rating.snapshot_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "--"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Last Updated</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#f5a623] to-neon transition-all duration-700"
                          style={{
                            width: `${Math.min(((rating.elo_score - 900) / 600) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span className="text-[9px] text-muted-foreground/40">900</span>
                        <span className="text-[9px] text-muted-foreground/40">1200</span>
                        <span className="text-[9px] text-muted-foreground/40">1500</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
