"use client";

import { ReactNode, useState } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  controls?: ReactNode;
  className?: string;
  minHeight?: number;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  controls,
  className = "",
  minHeight = 400,
  loading = false,
  empty = false,
  emptyMessage = "No data available",
}: ChartCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden ${
        isFullscreen
          ? "fixed inset-4 z-50 flex flex-col"
          : ""
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          {subtitle && (
            <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {controls}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded p-1 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`p-4 ${isFullscreen ? "flex-1" : ""}`}
        style={{ minHeight: isFullscreen ? undefined : minHeight }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full" style={{ minHeight }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#00d4aa]/30 border-t-[#00d4aa] rounded-full animate-spin" />
              <span className="text-xs text-white/30">Loading data...</span>
            </div>
          </div>
        ) : empty ? (
          <div className="flex items-center justify-center h-full" style={{ minHeight }}>
            <div className="text-center">
              <div className="text-white/20 text-sm">{emptyMessage}</div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Fullscreen overlay backdrop */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/80 -z-10"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </div>
  );
}
