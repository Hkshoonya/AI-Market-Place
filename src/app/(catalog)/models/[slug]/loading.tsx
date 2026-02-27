export default function ModelDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Back nav */}
      <div className="h-5 w-32 animate-pulse rounded bg-secondary mb-6" />
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-64 animate-pulse rounded-lg bg-secondary" />
            <div className="h-7 w-12 animate-pulse rounded bg-secondary" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
            <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
          </div>
          <div className="mt-4 h-12 w-full max-w-2xl animate-pulse rounded bg-secondary" />
        </div>
      </div>
      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      {/* Tabs skeleton */}
      <div className="mt-8">
        <div className="h-10 w-96 animate-pulse rounded-lg bg-secondary mb-6" />
        <div className="h-80 animate-pulse rounded-xl bg-secondary" />
      </div>
    </div>
  );
}
