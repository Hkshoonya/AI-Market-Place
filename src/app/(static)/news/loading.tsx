export default function NewsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="h-5 w-72 animate-pulse rounded bg-secondary mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-xl border border-border/30 p-4"
          >
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-full animate-pulse rounded bg-secondary" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
