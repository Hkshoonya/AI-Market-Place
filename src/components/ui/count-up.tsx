"use client";

interface CountUpProps {
  end: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function CountUp({
  end,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: CountUpProps) {
  const formatNumber = (n: number) => {
    if (decimals > 0) return n.toFixed(decimals);
    return Math.round(n).toLocaleString();
  };

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{formatNumber(end)}{suffix}
    </span>
  );
}
