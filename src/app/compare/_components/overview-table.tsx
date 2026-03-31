"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import {
  formatParams,
  formatContextWindow,
  formatNumber,
} from "@/lib/format";
import { ComparisonRow } from "./comparison-row";
import {
  getCompareDeploymentLabel,
  type CompareAccessOffer,
} from "./compare-helpers";
import type { ModelWithDetails } from "@/types/database";
import type { ModelSignalSummary } from "@/lib/news/model-signals";

interface OverviewTableProps {
  models: ModelWithDetails[];
  modelSignals: Record<string, ModelSignalSummary | null>;
  accessOffers: Record<string, CompareAccessOffer | null>;
}

export function OverviewTable({ models, modelSignals, accessOffers }: OverviewTableProps) {
  const providerValues = useMemo(
    () => models.map((m) => m.provider),
    [models]
  );

  const categoryValues = useMemo(
    () =>
      models.map((m) => {
        const cat = CATEGORY_MAP[m.category as keyof typeof CATEGORY_MAP];
        return cat?.label ?? m.category;
      }),
    [models]
  );

  const qualityValues = useMemo(
    () =>
      models.map((m) =>
        m.quality_score ? Number(m.quality_score).toFixed(1) : null
      ),
    [models]
  );

  const rankValues = useMemo(
    () => models.map((m) => (m.overall_rank ? `#${m.overall_rank}` : null)),
    [models]
  );

  const paramValues = useMemo(
    () => models.map((m) => formatParams(m.parameter_count)),
    [models]
  );

  const contextValues = useMemo(
    () =>
      models.map((m) =>
        m.context_window ? formatContextWindow(m.context_window) : null
      ),
    [models]
  );

  const openWeightsValues = useMemo(
    () => models.map((m) => (m.is_open_weights ? "Yes" : "No")),
    [models]
  );

  const deploymentValues = useMemo(
    () =>
      models.map((m) =>
        getCompareDeploymentLabel({
          model: m,
          signal: modelSignals[m.slug] ?? null,
          accessOffer: accessOffers[m.slug] ?? null,
        })
      ),
    [accessOffers, modelSignals, models]
  );

  const downloadValues = useMemo(
    () => models.map((m) => formatNumber(m.hf_downloads)),
    [models]
  );

  const releaseDateValues = useMemo(
    () =>
      models.map((m) =>
        m.release_date
          ? new Date(m.release_date).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })
          : null
      ),
    [models]
  );

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="bg-secondary/20">
        <CardTitle className="text-lg">Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                  Metric
                </th>
                {models.map((m) => (
                  <th
                    key={m.slug}
                    className="px-4 py-3 text-center text-xs font-medium"
                  >
                    <Link
                      href={`/models/${m.slug}`}
                      className="hover:text-neon transition-colors"
                    >
                      {m.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ComparisonRow label="Provider" values={providerValues} />
              <ComparisonRow label="Category" values={categoryValues} />
              <ComparisonRow
                label="Quality Score"
                values={qualityValues}
                highlight="max"
              />
              <ComparisonRow label="Overall Rank" values={rankValues} />
              <ComparisonRow label="Parameters" values={paramValues} />
              <ComparisonRow label="Context Window" values={contextValues} />
              <ComparisonRow label="Deployment" values={deploymentValues} />
              <ComparisonRow label="Open Weights" values={openWeightsValues} />
              <ComparisonRow
                label="Downloads"
                values={downloadValues}
                highlight="max"
              />
              <ComparisonRow label="Release Date" values={releaseDateValues} />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
