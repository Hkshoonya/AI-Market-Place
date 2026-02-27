export default function CompareLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="h-4 w-32 animate-pulse rounded bg-secondary mb-6" />
      <div className="h-8 w-64 animate-pulse rounded-lg bg-secondary" />
      <div className="h-5 w-96 animate-pulse rounded bg-secondary mt-2" />

      {/* Model selector cards skeleton */}
      <div className="mt-8 flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 w-40 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
        <div className="h-20 w-40 animate-pulse rounded-xl border-2 border-dashed border-secondary bg-secondary/20" />
      </div>

      {/* Table skeleton */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border/50">
        <div className="h-12 bg-secondary/30" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-border/30 animate-pulse bg-secondary/10"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl bg-secondary/20 border border-border/50" />
        <div className="h-72 animate-pulse rounded-xl bg-secondary/20 border border-border/50" />
      </div>
    </div>
  );
}
