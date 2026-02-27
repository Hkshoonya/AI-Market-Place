export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-6 w-6 animate-pulse rounded bg-secondary" />
        <div className="h-7 w-36 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="space-y-6">
        <div className="rounded-xl border border-border/50 p-6 space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
          <div className="space-y-3">
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
        </div>
        <div className="rounded-xl border border-border/50 p-6 space-y-4">
          <div className="h-5 w-40 animate-pulse rounded bg-secondary" />
          <div className="space-y-3">
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
        </div>
        <div className="h-10 w-32 animate-pulse rounded-lg bg-secondary" />
      </div>
    </div>
  );
}
