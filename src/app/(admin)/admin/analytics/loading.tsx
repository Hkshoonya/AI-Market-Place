export default function AdminAnalyticsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-36 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-secondary mb-6" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-secondary" />
        <div className="h-48 animate-pulse rounded-xl bg-secondary" />
      </div>
    </div>
  );
}
