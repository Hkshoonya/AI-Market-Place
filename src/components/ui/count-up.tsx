"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function CountUp({
  end,
  duration = 2000,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: CountUpProps) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTime = useRef<number | null>(null);
  const frameRef = useRef<number>(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;

          const animate = (timestamp: number) => {
            if (!startTime.current) startTime.current = timestamp;
            const elapsed = timestamp - startTime.current;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * end;
            countRef.current = current;
            setCount(current);

            if (progress < 1) {
              frameRef.current = requestAnimationFrame(animate);
            }
          };

          frameRef.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration]);

  const formatNumber = (n: number) => {
    if (decimals > 0) return n.toFixed(decimals);
    return Math.round(n).toLocaleString();
  };

  return (
    <span ref={elementRef} className={`tabular-nums ${className}`}>
      {prefix}{formatNumber(count)}{suffix}
    </span>
  );
}
