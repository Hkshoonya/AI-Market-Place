export default function SignupLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="h-8 w-44 mx-auto animate-pulse rounded-lg bg-secondary" />
          <div className="h-4 w-64 mx-auto animate-pulse rounded bg-secondary" />
        </div>
        <div className="rounded-xl border border-border/50 p-6 space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-lg bg-secondary" />
        </div>
      </div>
    </div>
  );
}
