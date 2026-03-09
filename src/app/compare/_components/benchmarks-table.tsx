"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComparisonRow } from "./comparison-row";
import { getBenchmarkScore } from "./compare-helpers";
import type { BenchmarkInfo } from "./compare-helpers";
import type { ModelWithDetails } from "@/types/database";

interface BenchmarksTableProps {
  models: ModelWithDetails[];
  allBenchmarks: BenchmarkInfo[];
}

export function BenchmarksTable({
  models,
  allBenchmarks,
}: BenchmarksTableProps) {
  const benchmarkRows = useMemo(
    () =>
      allBenchmarks.map((bm) => ({
        slug: bm.slug,
        name: bm.name,
        values: models.map((m) => {
          const score = getBenchmarkScore(m, bm.slug);
          return score !== null ? score.toFixed(1) : null;
        }),
      })),
    [models, allBenchmarks]
  );

  if (allBenchmarks.length === 0) return null;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="bg-secondary/20">
        <CardTitle className="text-lg">Benchmarks</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                  Benchmark
                </th>
                {models.map((m) => (
                  <th
                    key={m.slug}
                    className="px-4 py-3 text-center text-xs font-medium"
                  >
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benchmarkRows.map((row) => (
                <ComparisonRow
                  key={row.slug}
                  label={row.name}
                  values={row.values}
                  highlight="max"
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
