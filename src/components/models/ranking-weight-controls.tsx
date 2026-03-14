"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Settings2,
  RotateCcw,
  Info,
  ChevronDown,
  Minus,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type RankableModel,
  type WeightKey,
  DEFAULT_WEIGHTS,
  WEIGHT_KEYS,
  MAX_WEIGHT,
  STEP,
  computePercentiles,
  redistributeWeights,
} from "./ranking-weight-helpers";

interface RankingWeightControlsProps {
  models: RankableModel[];
  onSortedModels: (models: RankableModel[]) => void;
}

export default function RankingWeightControls({
  models,
  onSortedModels,
}: RankingWeightControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"default" | "custom">("default");
  const [weights, setWeights] = useState<Record<WeightKey, number>>(() =>
    Object.fromEntries(
      WEIGHT_KEYS.map((key) => [key, DEFAULT_WEIGHTS[key].weight])
    ) as Record<WeightKey, number>
  );

  const hasMounted = useRef(false);
  const percentileMaps = useRef<Map<WeightKey, Map<string, number>>>(new Map());

  const buildPercentileMaps = useCallback((modelList: RankableModel[]) => {
    const maps = new Map<WeightKey, Map<string, number>>();
    for (const key of WEIGHT_KEYS) {
      maps.set(key, computePercentiles(modelList, key));
    }
    return maps;
  }, []);

  useEffect(() => {
    percentileMaps.current = buildPercentileMaps(models);
  }, [models, buildPercentileMaps]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
    }

    const maps = percentileMaps.current;
    if (maps.size === 0) return;

    const scored = models.map((model) => {
      let composite = 0;

      for (const key of WEIGHT_KEYS) {
        const percentileMap = maps.get(key);
        const percentile = percentileMap?.get(model.slug) ?? 0;
        composite += (weights[key] / 100) * percentile;
      }

      return { model, composite };
    });

    scored.sort((left, right) => right.composite - left.composite);
    onSortedModels(scored.map((entry) => entry.model));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights, models]);

  const isDefault = WEIGHT_KEYS.every(
    (key) => weights[key] === DEFAULT_WEIGHTS[key].weight
  );

  const handleWeightChange = useCallback((key: WeightKey, delta: number) => {
    setWeights((current) =>
      redistributeWeights(current, key, current[key] + delta)
    );
    setMode("custom");
  }, []);

  const resetToDefault = useCallback(() => {
    const defaults = Object.fromEntries(
      WEIGHT_KEYS.map((key) => [key, DEFAULT_WEIGHTS[key].weight])
    ) as Record<WeightKey, number>;
    setWeights(defaults);
    setMode("default");
  }, []);

  const total = WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);

  return (
    <TooltipProvider>
      <div className="mb-4">
        <button
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
            isOpen
              ? "border-neon/30 bg-neon/10 text-neon"
              : "border-white/[0.06] text-muted-foreground hover:border-white/10 hover:bg-secondary hover:text-foreground"
          )}
        >
          <Settings2 className="h-4 w-4" />
          Customize Thesis
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="mt-3 animate-slide-down rounded-xl border border-border/50 bg-secondary/20 p-4">
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white/80">
                  Market Cap Thesis
                </h4>
                <div className="flex overflow-hidden rounded-lg border border-white/[0.06]">
                  <button
                    onClick={resetToDefault}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors",
                      mode === "default" || isDefault
                        ? "bg-neon/10 text-neon"
                        : "text-white/40 hover:bg-white/[0.03] hover:text-white/60"
                    )}
                  >
                    House View
                  </button>
                  <button
                    onClick={() => setMode("custom")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors",
                      mode === "custom" && !isDefault
                        ? "bg-neon/10 text-neon"
                        : "text-white/40 hover:bg-white/[0.03] hover:text-white/60"
                    )}
                  >
                    Custom Mix
                  </button>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Our house view prioritizes capability, economic footing, and adoption
                ahead of short-term hype. Use a custom mix when you want to stress a
                different thesis.
              </p>
            </div>

            <div className="space-y-3">
              {WEIGHT_KEYS.map((key) => (
                <WeightRow
                  key={key}
                  weightKey={key}
                  signal={DEFAULT_WEIGHTS[key]}
                  value={weights[key]}
                  onChange={handleWeightChange}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  total === 100 ? "text-white/40" : "text-loss"
                )}
              >
                Total: {total}%
              </span>
              <button
                onClick={resetToDefault}
                disabled={isDefault}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  isDefault
                    ? "cursor-not-allowed border-white/[0.04] text-white/20"
                    : "border-white/[0.08] bg-secondary text-white/60 hover:bg-secondary/80 hover:text-white/80"
                )}
              >
                <RotateCcw className="h-3 w-3" />
                Reset House View
              </button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

interface WeightRowProps {
  weightKey: WeightKey;
  signal: { label: string; weight: number; description: string };
  value: number;
  onChange: (key: WeightKey, delta: number) => void;
}

function WeightRow({ weightKey, signal, value, onChange }: WeightRowProps) {
  const pct = Math.min(value, 100);
  const isZero = value === 0;
  const isMax = value >= MAX_WEIGHT;

  return (
    <div className="flex items-center gap-3">
      <div className="flex w-36 shrink-0 items-center gap-1.5">
        <span
          className={cn(
            "truncate text-xs font-medium",
            isZero ? "text-white/25" : "text-white/70"
          )}
        >
          {signal.label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-white/20 transition-colors hover:text-white/50"
              aria-label={`Info about ${signal.label}`}
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            <p className="max-w-[200px]">{signal.description}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background:
              value > 0
                ? "linear-gradient(90deg, rgba(0,212,170,0.3), rgba(0,212,170,0.6))"
                : "transparent",
          }}
        />
      </div>

      <span
        className={cn(
          "w-10 text-right text-xs font-semibold tabular-nums",
          isZero ? "text-white/20" : "text-white/60"
        )}
      >
        {value}%
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(weightKey, -STEP)}
          disabled={isZero}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded text-xs transition-colors",
            isZero
              ? "cursor-not-allowed text-white/10"
              : "bg-secondary text-white/50 hover:bg-secondary/80 hover:text-white/80"
          )}
          aria-label={`Decrease ${signal.label} weight`}
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onChange(weightKey, STEP)}
          disabled={isMax}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded text-xs transition-colors",
            isMax
              ? "cursor-not-allowed text-white/10"
              : "bg-secondary text-white/50 hover:bg-secondary/80 hover:text-white/80"
          )}
          aria-label={`Increase ${signal.label} weight`}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
