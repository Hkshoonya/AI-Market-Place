export default function ContactLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="text-center space-y-2 mb-8">
        <div className="h-8 w-40 mx-auto animate-pulse rounded-lg bg-secondary" />
        <div className="h-4 w-72 mx-auto animate-pulse rounded bg-secondary" />
      </div>
      <div className="rounded-xl border border-border/50 p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
          <div className="h-28 w-full animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
      </div>
    </div>
  );
}
