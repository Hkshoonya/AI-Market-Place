export default function AdminModelsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
          <div className="h-7 w-36 animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="h-10 w-64 animate-pulse rounded-lg bg-secondary mb-4" />
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
