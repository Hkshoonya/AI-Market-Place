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
  const numValues = values.map((v) =>
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : null
  );

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
