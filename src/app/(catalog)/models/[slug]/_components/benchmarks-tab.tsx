import { Swords, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BenchmarkRadar } from "@/components/charts/benchmark-radar";
import { formatNumber } from "@/lib/format";

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
}

export function BenchmarksTab({ benchmarkScores, eloRatings }: BenchmarksTabProps) {
  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Benchmark Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {benchmarkScores.length > 0 ? (
            <>
              <div className="mb-8">
                <BenchmarkRadar
                  scores={benchmarkScores.map((bs) => ({
                    benchmark: bs.benchmarks?.name ?? "Unknown",
                    score: Number(bs.score_normalized ?? bs.score),
                    maxScore: 100,
                  }))}
                />
              </div>
              <div className="space-y-4">
                {benchmarkScores.map((bs, i) => {
                  const maxScore = 100;
                  const score = Number(bs.score_normalized ?? bs.score);
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <span className="text-sm font-medium">{bs.benchmarks?.name ?? "Unknown"}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground capitalize">{bs.benchmarks?.category ?? ""}</span>
                      </div>
                      <div className="flex-1">
                        <div className="relative h-3 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-neon/70 to-neon animate-score-bar"
                            style={{ width: `${(score / maxScore) * 100}%`, animationDelay: `${i * 80}ms` }}
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
            <p className="text-center text-muted-foreground py-8">No benchmark data available yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Arena ELO Section */}
      {eloRatings.length > 0 && (
        <Card className="border-border/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Swords className="h-5 w-5 text-neon" />
              Arena ELO Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {eloRatings.map((elo, i) => {
                const ciLow = elo.confidence_interval_low;
                const ciHigh = elo.confidence_interval_high;
                const ciWidth = ciLow && ciHigh ? ciHigh - ciLow : null;
                return (
                  <div key={i} className="rounded-lg border border-border/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-[#f5a623]" />
                        <span className="text-sm font-medium capitalize">
                          {elo.arena_name.replace(/-/g, " ")}
                        </span>
                      </div>
                      {elo.rank && (
                        <Badge className="bg-neon/10 text-neon text-xs">
                          Arena Rank #{elo.rank}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{elo.elo_score}</p>
                        <p className="text-[11px] text-muted-foreground">ELO Score</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium tabular-nums">
                          {ciLow && ciHigh
                            ? `${ciLow} — ${ciHigh}`
                            : "—"}
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
                          {elo.num_battles ? formatNumber(elo.num_battles) : "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Battles</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium tabular-nums">
                          {elo.snapshot_date
                            ? new Date(elo.snapshot_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Last Updated</p>
                      </div>
                    </div>
                    {/* ELO strength bar */}
                    <div className="mt-3">
                      <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#f5a623] to-neon transition-all duration-700"
                          style={{
                            width: `${Math.min(((elo.elo_score - 900) / 600) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
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
