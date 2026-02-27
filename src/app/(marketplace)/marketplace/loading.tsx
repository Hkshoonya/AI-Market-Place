export default function MarketplaceLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-44 animate-pulse rounded-lg bg-secondary" />
      </div>
      {/* Category cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      {/* Featured listings */}
      <div className="h-7 w-40 animate-pulse rounded bg-secondary mb-4" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
