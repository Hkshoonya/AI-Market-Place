import { useState } from "react";

export interface TooltipState {
  x: number;
  y: number;
  modelName: string;
  benchmarkName: string;
  score: number | null;
}

interface UseHeatmapTooltipOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface UseHeatmapTooltipReturn {
  tooltip: TooltipState | null;
  handleCellHover: (
    e: React.MouseEvent,
    modelName: string,
    benchmarkName: string,
    score: number | null
  ) => void;
  handleCellLeave: () => void;
}

export function useHeatmapTooltip({
  containerRef,
}: UseHeatmapTooltipOptions): UseHeatmapTooltipReturn {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const handleCellHover = (
    e: React.MouseEvent,
    modelName: string,
    benchmarkName: string,
    score: number | null
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      modelName,
      benchmarkName,
      score,
    });
  };

  const handleCellLeave = () => {
    setTooltip(null);
  };

  return { tooltip, handleCellHover, handleCellLeave };
}
