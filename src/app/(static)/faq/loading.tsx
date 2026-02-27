export default function FaqLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center space-y-2 mb-8">
        <div className="h-8 w-56 mx-auto animate-pulse rounded-lg bg-secondary" />
        <div className="h-4 w-80 mx-auto animate-pulse rounded bg-secondary" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-secondary"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
