export default function PrivacyLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-secondary mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-secondary/50"
            style={{
              width: `${90 - i * 4}%`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-10 h-8 w-44 animate-pulse rounded-lg bg-secondary" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-secondary/50"
            style={{
              width: `${85 - i * 6}%`,
              animationDelay: `${(i + 8) * 50}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
