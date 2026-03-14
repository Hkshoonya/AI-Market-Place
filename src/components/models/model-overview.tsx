"use client";

import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, ThumbsUp, ThumbsDown, Tag } from "lucide-react";

interface ProConItem {
  title: string;
  description: string;
  source: string;
}

interface ModelDescriptionData {
  summary: string | null;
  highlights?: Array<{
    label: string;
    value: string;
    tone: "verified" | "estimated" | "generated" | "coverage";
  }>;
  pros: ProConItem[];
  cons: ProConItem[];
  best_for: string[];
  not_ideal_for: string[];
  evidence_badges?: string[];
  methodology?: {
    hiddenByDefault: boolean;
    summary: string;
    sourceLabels: string[];
    confidenceLabel: string;
  };
  comparison_notes: string | null;
  generated_by: string;
  upvotes: number;
  downvotes: number;
}

interface ModelOverviewProps {
  modelSlug: string;
  className?: string;
}

export function ModelOverview({ modelSlug, className }: ModelOverviewProps) {
  const { data: description, error, isLoading } = useSWR<ModelDescriptionData>(
    modelSlug ? `/api/models/${modelSlug}/description` : null,
    { ...SWR_TIERS.SLOW }
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="h-16 rounded-lg bg-card/30 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 rounded-lg bg-card/30 animate-pulse" />
          <div className="h-32 rounded-lg bg-card/30 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-500 p-4">{error?.message || "Failed to load model overview"}</p>;

  if (!description) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      {description.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description.summary}
        </p>
      )}

      {description.highlights && description.highlights.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {description.highlights.map((highlight, index) => (
            <div
              key={`${highlight.label}-${index}`}
              className="rounded-lg border border-border/50 bg-card/20 p-3"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {highlight.label}
              </p>
              <p className="mt-2 text-sm font-medium text-white">{highlight.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pros & Cons */}
      {(description.pros.length > 0 || description.cons.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pros */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Strengths
            </h4>
            {description.pros.map((pro, i) => (
              <div key={i} className="rounded-lg border border-green-500/10 bg-green-500/5 p-3">
                <p className="text-sm font-medium text-white">{pro.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pro.description}</p>
              </div>
            ))}
          </div>

          {/* Cons */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Limitations
            </h4>
            {description.cons.map((con, i) => (
              <div key={i} className="rounded-lg border border-red-500/10 bg-red-500/5 p-3">
                <p className="text-sm font-medium text-white">{con.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{con.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best For / Not Ideal For Tags */}
      <div className="flex flex-wrap gap-4">
        {description.best_for.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground mr-2">Best for:</span>
            <div className="inline-flex flex-wrap gap-1">
              {description.best_for.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[#00d4aa]/10 text-[#00d4aa]">
                  <Tag className="h-2.5 w-2.5" /> {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {description.not_ideal_for.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground mr-2">Not ideal for:</span>
            <div className="inline-flex flex-wrap gap-1">
              {description.not_ideal_for.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400">
                  <Tag className="h-2.5 w-2.5" /> {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Votes & Source */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" /> {description.upvotes}
        </div>
        <div className="flex items-center gap-1">
          <ThumbsDown className="h-3 w-3" /> {description.downvotes}
        </div>
        <span className="capitalize">Source: {description.generated_by}</span>
      </div>

      {description.evidence_badges && description.evidence_badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {description.evidence_badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex rounded-full border border-border/50 bg-card/20 px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {description.methodology ? (
        <details className="rounded-xl border border-border/50 bg-card/20 p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Methodology / Sources
          </summary>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>{description.methodology.summary}</p>
            <p>
              Confidence:{" "}
              <span className="font-medium text-foreground">
                {description.methodology.confidenceLabel}
              </span>
            </p>
            <p>Evidence classes: {description.methodology.sourceLabels.join(", ")}</p>
          </div>
        </details>
      ) : null}
    </div>
  );
}
