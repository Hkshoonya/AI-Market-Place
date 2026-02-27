export default function WatchlistsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
          <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 75}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
