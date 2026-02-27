export default function TermsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center space-y-2 mb-8">
        <div className="h-8 w-48 mx-auto animate-pulse rounded-lg bg-secondary" />
        <div className="h-4 w-64 mx-auto animate-pulse rounded bg-secondary" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-secondary" />
            <div className="h-4 w-full animate-pulse rounded bg-secondary" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-secondary" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
