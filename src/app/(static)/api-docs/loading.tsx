export default function ApiDocsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-secondary mb-2" />
      <div className="h-5 w-96 animate-pulse rounded bg-secondary mb-8" />

      {/* Endpoint cards skeleton */}
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 p-6 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-6 w-12 animate-pulse rounded bg-neon/20" />
              <div className="h-6 w-64 animate-pulse rounded bg-secondary" />
            </div>
            <div className="h-4 w-full animate-pulse rounded bg-secondary/60" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-secondary/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
