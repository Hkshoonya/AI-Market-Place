"use client";

import { memo } from "react";
import { Trophy } from "lucide-react";

interface ComparisonRowProps {
  label: string;
  values: (string | number | null)[];
  highlight?: "max" | "min" | null;
}

export const ComparisonRow = memo(function ComparisonRow({
  label,
  values,
  highlight,
}: ComparisonRowProps) {
  const parseComparableNumber = (value: string | number | null): number | null => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return null;
    const match = value.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const numValues = values.map((v) => parseComparableNumber(v));

  let bestIdx = -1;
  if (highlight && numValues.some((v) => v !== null && !isNaN(v))) {
    const validValues = numValues.filter(
      (v) => v !== null && !isNaN(v)
    ) as number[];
    if (validValues.length > 0) {
      const target =
        highlight === "max"
          ? Math.max(...validValues)
          : Math.min(...validValues);
      bestIdx = numValues.findIndex((v) => v === target);
    }
  }

  return (
    <tr className="border-b border-border/30">
      <td className="px-4 py-3 text-sm text-muted-foreground font-medium w-40">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-3 text-sm text-center tabular-nums ${
            i === bestIdx ? "text-neon font-bold" : ""
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            {v ?? "\u2014"}
            {i === bestIdx && <Trophy className="h-3 w-3 text-neon" />}
          </div>
        </td>
      ))}
    </tr>
  );
});
