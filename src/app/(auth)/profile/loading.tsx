export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start gap-4 mb-8">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-secondary" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-secondary" />
          <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
          <div className="flex gap-4 mt-2">
            <div className="h-3 w-20 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-20 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
