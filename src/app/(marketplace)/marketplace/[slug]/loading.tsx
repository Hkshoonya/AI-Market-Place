export default function ListingDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-5 w-32 animate-pulse rounded bg-secondary mb-6" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-10 w-3/4 animate-pulse rounded-lg bg-secondary" />
          <div className="flex gap-2">
            <div className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-secondary" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-secondary" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-secondary" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-secondary" />
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-secondary" />
        </div>
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-xl bg-secondary" />
          <div className="h-12 animate-pulse rounded-xl bg-secondary" />
          <div className="h-32 animate-pulse rounded-xl bg-secondary" />
        </div>
      </div>
    </div>
  );
}
