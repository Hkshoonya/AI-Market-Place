"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Settings2, RotateCcw, Info, ChevronDown, Minus, Plus } from "lucide-react";
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
  // REMOVED: MIN_WEIGHT,
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
    Object.fromEntries(WEIGHT_KEYS.map((k) => [k, DEFAULT_WEIGHTS[k].weight])) as Record<WeightKey, number>,
  );

  // Track whether we've done the initial sort to avoid duplicate calls
  const hasMounted = useRef(false);

  // Memoize percentile maps only when models change
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

    const scored = models.map((m) => {
      let composite = 0;
      for (const key of WEIGHT_KEYS) {
        const pctMap = maps.get(key);
        const percentile = pctMap?.get(m.slug) ?? 0;
        composite += (weights[key] / 100) * percentile;
      }
      return { model: m, composite };
    });

    scored.sort((a, b) => b.composite - a.composite);
    onSortedModels(scored.map((s) => s.model));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights, models]);

  const isDefault = WEIGHT_KEYS.every((k) => weights[k] === DEFAULT_WEIGHTS[k].weight);

  const handleWeightChange = useCallback((key: WeightKey, delta: number) => {
    setWeights((prev) => redistributeWeights(prev, key, prev[key] + delta));
    setMode("custom");
  }, []);

  const resetToDefault = useCallback(() => {
    const defaults = Object.fromEntries(
      WEIGHT_KEYS.map((k) => [k, DEFAULT_WEIGHTS[k].weight]),
    ) as Record<WeightKey, number>;
    setWeights(defaults);
    setMode("default");
  }, []);

  const total = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0);

  return (
    <TooltipProvider>
      <div className="mb-4">
        {/* Toggle button */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all border",
            isOpen
              ? "bg-neon/10 text-neon border-neon/30"
              : "text-muted-foreground border-white/[0.06] hover:bg-secondary hover:text-foreground hover:border-white/10",
          )}
        >
          <Settings2 className="h-4 w-4" />
          Customize Rankings
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {/* Expanded panel */}
        {isOpen && (
          <div className="mt-3 rounded-xl border border-border/50 bg-secondary/20 p-4 animate-slide-down">
            {/* Header with mode tabs */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-white/80">
                Ranking Weights
              </h4>
              <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
                <button
                  onClick={resetToDefault}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors",
                    mode === "default" || isDefault
                      ? "bg-neon/10 text-neon"
                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]",
                  )}
                >
                  Our Pick
                </button>
                <button
                  onClick={() => setMode("custom")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors",
                    mode === "custom" && !isDefault
                      ? "bg-neon/10 text-neon"
                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]",
                  )}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Weight sliders */}
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

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  total === 100 ? "text-white/40" : "text-loss",
                )}
              >
                Total: {total}%
              </span>
              <button
                onClick={resetToDefault}
                disabled={isDefault}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
                  isDefault
                    ? "text-white/20 border-white/[0.04] cursor-not-allowed"
                    : "text-white/60 border-white/[0.08] bg-secondary hover:bg-secondary/80 hover:text-white/80",
                )}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to Default
              </button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// WeightRow sub-component

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
      {/* Label + tooltip */}
      <div className="flex items-center gap-1.5 w-36 shrink-0">
        <span
          className={cn(
            "text-xs font-medium truncate",
            isZero ? "text-white/25" : "text-white/70",
          )}
        >
          {signal.label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-white/20 hover:text-white/50 transition-colors"
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

      {/* Bar */}
      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
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

      {/* Percentage */}
      <span
        className={cn(
          "w-10 text-right text-xs font-semibold tabular-nums",
          isZero ? "text-white/20" : "text-white/60",
        )}
      >
        {value}%
      </span>

      {/* +/- buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onChange(weightKey, -STEP)}
          disabled={isZero}
          className={cn(
            "flex items-center justify-center h-6 w-6 rounded text-xs transition-colors",
            isZero
              ? "text-white/10 cursor-not-allowed"
              : "bg-secondary text-white/50 hover:bg-secondary/80 hover:text-white/80",
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
            "flex items-center justify-center h-6 w-6 rounded text-xs transition-colors",
            isMax
              ? "text-white/10 cursor-not-allowed"
              : "bg-secondary text-white/50 hover:bg-secondary/80 hover:text-white/80",
          )}
          aria-label={`Increase ${signal.label} weight`}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
