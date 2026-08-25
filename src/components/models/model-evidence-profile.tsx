import {
  Activity,
  Cpu,
  Database,
  ExternalLink,
  FileCheck2,
  Layers3,
  Scale,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatParams } from "@/lib/format";
import type { ModelEvidenceProfile } from "@/lib/models/evidence-profile";
import type { ModelMetadataEvidence } from "@/types/database";

interface ModelEvidenceProfileCardProps {
  profile: ModelEvidenceProfile;
  evidence: ModelMetadataEvidence[];
}

function formatScientific(value: number | null): string {
  if (value === null) return "Not reported";
  return `${Number(value).toExponential(1).replace("e+", "e")} FLOP`;
}

function formatDatasetScale(value: number | null): string {
  if (value === null) return "Not reported";
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1)}T units`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B units`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M units`;
  }
  return value.toLocaleString();
}

function sourceLabel(source: string): string {
  if (source === "epoch-ai") return "Epoch AI";
  if (source === "huggingface") return "Hugging Face";
  return source.replace(/[-_]/g, " ");
}

export function ModelEvidenceProfileCard({
  profile,
  evidence,
}: ModelEvidenceProfileCardProps) {
  const sortedEvidence = [...evidence].sort((left, right) => {
    const confidenceOrder: Record<string, number> = {
      confident: 3,
      likely: 2,
      speculative: 1,
      unknown: 0,
    };
    const confidenceDifference =
      (confidenceOrder[right.confidence?.toLowerCase() ?? "unknown"] ?? 0) -
      (confidenceOrder[left.confidence?.toLowerCase() ?? "unknown"] ?? 0);
    if (confidenceDifference !== 0) return confidenceDifference;
    return (
      Date.parse(right.source_last_modified_at ?? right.observed_at) -
      Date.parse(left.source_last_modified_at ?? left.observed_at)
    );
  });
  const primary = sortedEvidence[0] ?? null;
  const ringDegrees = Math.max(0, Math.min(360, profile.score * 3.6));
  const technicalFacts = primary
    ? [
        {
          label: "Parameters",
          value: formatParams(primary.parameter_count),
          icon: Cpu,
        },
        {
          label: "Training compute",
          value: formatScientific(primary.training_compute_flop),
          icon: Activity,
        },
        {
          label: "Dataset scale",
          value: formatDatasetScale(primary.training_dataset_size),
          icon: Scale,
        },
        {
          label: "Base model",
          value: primary.base_model ?? "Not reported",
          icon: Layers3,
        },
      ]
    : [];

  return (
    <Card className="relative mt-8 overflow-hidden border-[#00d4aa]/20 bg-card/80">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(0,212,170,0.13),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(56,189,248,0.08),transparent_32%)]" />
      <CardHeader className="relative border-b border-border/40 pb-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">
              <FileCheck2 className="h-4 w-4" />
              Evidence profile
            </div>
            <h2 className="mt-2 text-xl font-semibold">How complete is this record?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This measures the amount of verifiable public evidence we have, not how capable
              the model is. A missing field means it has not been verified yet, not that its
              value is zero.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#00d4aa ${ringDegrees}deg, rgba(148, 163, 184, 0.16) 0deg)`,
              }}
              aria-label={`${profile.score}% evidence coverage`}
            >
              <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-card shadow-inner">
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">{profile.score}%</div>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    coverage
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Badge
                variant="outline"
                className="border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]"
              >
                {profile.level}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                {profile.knownSignals} of {profile.totalSignals} public signals
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {profile.dimensions.map((dimension) => (
            <div key={dimension.key} className="rounded-xl border border-border/40 bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{dimension.label}</span>
                <span className="text-xs font-semibold tabular-nums text-[#00d4aa]">
                  {dimension.score}%
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00d4aa] to-sky-400"
                  style={{ width: `${dimension.score}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {dimension.known}/{dimension.total} signals
              </p>
            </div>
          ))}
        </div>

        {technicalFacts.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-semibold">Research-backed technical record</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {technicalFacts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                  <fact.icon className="h-4 w-4 text-sky-400" />
                  <p className="mt-3 text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                    {fact.label}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold">{fact.value}</p>
                </div>
              ))}
            </div>
            {primary?.accessibility && (
              <p className="mt-3 text-xs text-muted-foreground">
                Source-reported access: <span className="text-foreground">{primary.accessibility}</span>
                {primary.confidence ? ` · ${primary.confidence} confidence` : ""}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-border/40 pt-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Gaps we are still tracking
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.missing.length > 0 ? (
                profile.missing.map((item) => (
                  <Badge key={item} variant="outline" className="bg-background/40 font-normal">
                    {item}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="border-[#00d4aa]/30 text-[#00d4aa]">
                  No major evidence gaps
                </Badge>
              )}
            </div>
          </div>

          {sortedEvidence.length > 0 && (
            <div className="min-w-0 lg:max-w-md lg:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Metadata sources
              </p>
              <div className="mt-2 flex flex-wrap gap-2 lg:justify-end">
                {sortedEvidence.map((item) =>
                  item.source_url ? (
                    <a
                      key={item.id}
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-3 py-1 text-xs transition-colors hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
                    >
                      {sourceLabel(item.source)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Badge key={item.id} variant="outline">
                      {sourceLabel(item.source)}
                    </Badge>
                  )
                )}
              </div>
              {sortedEvidence.some((item) => item.source === "epoch-ai") && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Epoch AI, Data on AI Models. Used under CC BY with attribution.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
