export default function ActivityLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-40 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-border/30 p-4"
          >
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
