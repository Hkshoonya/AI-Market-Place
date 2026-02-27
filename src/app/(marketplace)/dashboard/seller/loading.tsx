export default function SellerDashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-secondary mb-2" />
      <div className="h-5 w-72 animate-pulse rounded bg-secondary mb-8" />

      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 75}ms` }}
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="h-7 w-32 animate-pulse rounded bg-secondary mb-4" />
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="h-10 bg-secondary/30" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 border-b border-border/30 animate-pulse bg-secondary/10"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
