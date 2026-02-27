export default function LeaderboardsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-52 animate-pulse rounded-lg bg-secondary" />
      </div>
      {/* Tab bar skeleton */}
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-secondary mb-6" />
      {/* Top 3 cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="h-10 bg-secondary/30" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-14 border-b border-border/30 animate-pulse bg-secondary/10"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
