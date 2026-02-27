export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-secondary" />
        <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
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
