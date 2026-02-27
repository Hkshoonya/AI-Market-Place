export default function ProviderDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-14 w-14 animate-pulse rounded-xl bg-secondary" />
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
          <div className="h-4 w-64 animate-pulse rounded bg-secondary" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
