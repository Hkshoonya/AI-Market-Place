export default function SellLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary mb-2" />
      <div className="h-5 w-80 animate-pulse rounded bg-secondary mb-8" />

      {/* Form skeleton */}
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-secondary" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
          <div className="h-32 w-full animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
        </div>
        <div className="h-10 w-full animate-pulse rounded-lg bg-neon/20" />
      </div>
    </div>
  );
}
