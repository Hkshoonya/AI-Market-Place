export default function OrderDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 w-4 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
      </div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
        </div>
        <div className="rounded-xl border border-border/50 p-6 space-y-4">
          <div className="h-5 w-28 animate-pulse rounded bg-secondary" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 animate-pulse rounded bg-secondary" />
                <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/50 p-6 space-y-4">
          <div className="h-5 w-36 animate-pulse rounded bg-secondary" />
          <div className="h-20 w-full animate-pulse rounded-lg bg-secondary" />
        </div>
      </div>
    </div>
  );
}
