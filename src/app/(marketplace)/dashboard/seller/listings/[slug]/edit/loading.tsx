export default function EditListingLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="h-5 w-32 animate-pulse rounded bg-secondary mb-4" />
      <div className="h-8 w-56 animate-pulse rounded-lg bg-secondary mb-8" />
      <div className="space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
        ))}
        <div className="h-12 w-32 animate-pulse rounded-lg bg-secondary" />
      </div>
    </div>
  );
}
