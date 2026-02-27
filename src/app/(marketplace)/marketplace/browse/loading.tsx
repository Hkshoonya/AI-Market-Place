export default function BrowseLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-secondary mb-6" />

      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-secondary" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-secondary" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-secondary" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-secondary" />
        <div className="ml-auto h-10 w-32 animate-pulse rounded-lg bg-secondary" />
      </div>

      {/* Listings grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
