"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatParams, formatRelativeDate } from "@/lib/format";

interface WatchlistModel {
  id: string;
  model_id: string;
  added_at: string;
  models: {
    id: string;
    slug: string;
    name: string;
    provider: string;
    category: string;
    overall_rank: number | null;
    quality_score: number | null;
    hf_downloads: number;
    hf_likes: number;
    release_date: string | null;
    parameter_count: number | null;
    context_window: number | null;
    is_open_weights: boolean;
  } | null;
}

interface WatchlistModelTableProps {
  items: WatchlistModel[];
  onRemove?: (modelId: string) => void;
  removingId?: string | null;
  isOwner: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM",
  image_generation: "Image Gen",
  vision: "Vision",
  multimodal: "Multimodal",
  embeddings: "Embeddings",
  speech_audio: "Speech/Audio",
  video: "Video",
  code: "Code",
  specialized: "Specialized",
};

export function WatchlistModelTable({
  items,
  onRemove,
  removingId,
  isOwner,
}: WatchlistModelTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No models in this watchlist yet.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add models from any model detail page using the &quot;Watch&quot; button.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/30">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 bg-secondary/30">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              #
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Model
            </th>
            <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
              Category
            </th>
            <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground sm:table-cell">
              Parameters
            </th>
            <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground lg:table-cell">
              Downloads
            </th>
            <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground lg:table-cell">
              Quality
            </th>
            <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground md:table-cell">
              Added
            </th>
            {isOwner && (
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">

              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const model = item.models;
            if (!model) return null;

            return (
              <tr
                key={item.id}
                className="border-b border-border/20 transition-colors hover:bg-secondary/20"
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {model.overall_rank ?? idx + 1}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/models/${model.slug}`}
                    className="group flex flex-col"
                  >
                    <span className="font-medium group-hover:text-neon transition-colors">
                      {model.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {model.provider}
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground">
                    {CATEGORY_LABELS[model.category] ?? model.category}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right sm:table-cell">
                  {formatParams(model.parameter_count)}
                </td>
                <td className="hidden px-4 py-3 text-right lg:table-cell">
                  {formatNumber(model.hf_downloads)}
                </td>
                <td className="hidden px-4 py-3 text-right lg:table-cell">
                  {model.quality_score != null ? (
                    <span className="text-neon">
                      {model.quality_score.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hidden px-4 py-3 text-right text-muted-foreground md:table-cell">
                  {formatRelativeDate(item.added_at)}
                </td>
                {isOwner && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-loss"
                      onClick={() => onRemove?.(model.id)}
                      disabled={removingId === model.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
