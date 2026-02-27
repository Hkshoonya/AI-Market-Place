export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-40 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="h-12 w-full animate-pulse rounded-xl bg-secondary mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 75}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
