export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-secondary" />
          <div className="space-y-2">
            <div className="h-6 w-40 rounded bg-secondary" />
            <div className="h-4 w-56 rounded bg-secondary" />
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-20 rounded bg-secondary" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-secondary" />
        ))}
      </div>
    </div>
  );
}
