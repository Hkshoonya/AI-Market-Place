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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RankableModel {
  name: string;
  slug: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  category_rank: number | null;
  quality_score: number | null;
  value_score: number | null;
  is_open_weights: boolean;
  hf_downloads: number | null;
  popularity_score: number | null;
  agent_score: number | null;
  agent_rank: number | null;
  popularity_rank: number | null;
  market_cap_estimate: number | null;
}

interface RankingWeightControlsProps {
  models: RankableModel[];
  onSortedModels: (models: RankableModel[]) => void;
}

// ---------------------------------------------------------------------------
// Weight signal definitions
// ---------------------------------------------------------------------------

type WeightKey = "humaneval" | "market_cap" | "quality" | "popularity" | "agent";

interface WeightSignal {
  label: string;
  weight: number;
  description: string;
}

const DEFAULT_WEIGHTS: Record<WeightKey, WeightSignal> = {
  humaneval: {
    label: "HumanEval Score",
    weight: 30,
    description: "Code generation benchmark",
  },
  market_cap: {
    label: "Market Cap",
    weight: 25,
    description: "Revenue-based market importance",
  },
  quality: {
    label: "Quality Score",
    weight: 20,
    description: "Combined benchmark performance",
  },
  popularity: {
    label: "Popularity",
    weight: 15,
    description: "Downloads, likes, and usage",
  },
  agent: {
    label: "Agent Score",
    weight: 10,
    description: "Agentic task performance",
  },
};

const WEIGHT_KEYS: WeightKey[] = [
  "humaneval",
  "market_cap",
  "quality",
  "popularity",
  "agent",
];

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 60;
const STEP = 5;

// ---------------------------------------------------------------------------
// Helpers: raw-value accessor per signal key
// ---------------------------------------------------------------------------

function getRawValue(model: RankableModel, key: WeightKey): number | null {
  switch (key) {
    case "humaneval":
      return model.quality_score;
    case "market_cap":
      return model.market_cap_estimate;
    case "quality":
      return model.quality_score;
    case "popularity":
      return model.popularity_score;
    case "agent":
      return model.agent_score;
  }
}

// ---------------------------------------------------------------------------
// Helpers: percentile ranking
// ---------------------------------------------------------------------------

/**
 * For a given signal key, compute a mapping from model slug to its percentile
 * rank (0 -- 100) among all models that have a non-null value. Models with
 * null values receive percentile 0 so they rank lowest on that axis.
 */
function computePercentiles(
  models: RankableModel[],
  key: WeightKey,
): Map<string, number> {
  const values: { slug: string; value: number }[] = [];
  for (const m of models) {
    const v = getRawValue(m, key);
    if (v != null) {
      values.push({ slug: m.slug, value: v });
    }
  }

  // Sort ascending so lowest value gets rank 0, highest gets 100
  values.sort((a, b) => a.value - b.value);

  const count = values.length;
  const result = new Map<string, number>();

  // Assign null-value models a percentile of 0
  for (const m of models) {
    result.set(m.slug, 0);
  }

  if (count > 1) {
    for (let i = 0; i < count; i++) {
      const percentile = (i / (count - 1)) * 100;
      result.set(values[i].slug, percentile);
    }
  } else if (count === 1) {
    // Single non-null model gets 100
    result.set(values[0].slug, 100);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers: weight redistribution
// ---------------------------------------------------------------------------

/**
 * When one weight changes, redistribute the excess / deficit proportionally
 * across the remaining weights so the total stays at 100.
 *
 * - Clamps the changed weight to [MIN_WEIGHT, MAX_WEIGHT].
 * - Remaining weights are scaled proportionally.
 * - If all remaining weights are 0, distributes evenly.
 * - Each remaining weight is also clamped to [MIN_WEIGHT, MAX_WEIGHT].
 * - After clamping, any residual is distributed round-robin.
 */
function redistributeWeights(
  current: Record<WeightKey, number>,
  changedKey: WeightKey,
  newValue: number,
): Record<WeightKey, number> {
  const clamped = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newValue));
  const remaining = 100 - clamped;
  const otherKeys = WEIGHT_KEYS.filter((k) => k !== changedKey);

  const otherSum = otherKeys.reduce((s, k) => s + current[k], 0);

  const result: Record<WeightKey, number> = { ...current, [changedKey]: clamped };

  if (otherSum === 0) {
    // Distribute remaining evenly
    const each = Math.floor(remaining / otherKeys.length);
    let leftover = remaining - each * otherKeys.length;
    for (const k of otherKeys) {
      result[k] = each + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover--;
    }
  } else {
    // Proportional redistribution
    let distributed = 0;
    const rawOthers: { key: WeightKey; value: number }[] = otherKeys.map((k) => {
      const proportional = Math.round((current[k] / otherSum) * remaining);
      return { key: k, value: Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, proportional)) };
    });

    // First pass: assign clamped proportional values
    for (const item of rawOthers) {
      result[item.key] = item.value;
      distributed += item.value;
    }

    // Second pass: fix rounding residual
    let residual = remaining - distributed;
    let idx = 0;
    while (residual !== 0 && idx < otherKeys.length * 10) {
      const key = otherKeys[idx % otherKeys.length];
      const dir = residual > 0 ? 1 : -1;
      const next = result[key] + dir;
      if (next >= MIN_WEIGHT && next <= MAX_WEIGHT) {
        result[key] = next;
        residual -= dir;
      }
      idx++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  const buildPercentileMaps = useCallback(
    (modelList: RankableModel[]) => {
      const maps = new Map<WeightKey, Map<string, number>>();
      for (const key of WEIGHT_KEYS) {
        maps.set(key, computePercentiles(modelList, key));
      }
      return maps;
    },
    [],
  );

  // Recompute percentile maps when models change
  useEffect(() => {
    percentileMaps.current = buildPercentileMaps(models);
  }, [models, buildPercentileMaps]);

  // Sorting effect: fires when weights or models change
  useEffect(() => {
    // Skip initial render to avoid double-call
    if (!hasMounted.current) {
      hasMounted.current = true;
      // Still sort initially so the parent gets the weighted order
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

  const handleWeightChange = useCallback(
    (key: WeightKey, delta: number) => {
      setWeights((prev) => {
        const next = redistributeWeights(prev, key, prev[key] + delta);
        return next;
      });
      setMode("custom");
    },
    [],
  );

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

// ---------------------------------------------------------------------------
// WeightRow sub-component
// ---------------------------------------------------------------------------

interface WeightRowProps {
  weightKey: WeightKey;
  signal: WeightSignal;
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
