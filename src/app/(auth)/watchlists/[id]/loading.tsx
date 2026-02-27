export default function WatchlistDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-5 w-24 animate-pulse rounded bg-secondary" />
      </div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-secondary" />
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-lg bg-secondary" />
          <div className="h-9 w-20 animate-pulse rounded-lg bg-secondary" />
        </div>
      </div>
      <div className="h-5 w-80 animate-pulse rounded bg-secondary mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 75}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
