export default function CategoryLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="h-5 w-80 animate-pulse rounded bg-secondary mb-8" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
