export default function DataSourcesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-16 animate-pulse rounded-lg bg-secondary"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 border-b border-border/30 animate-pulse bg-secondary/30"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
