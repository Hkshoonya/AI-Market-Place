export const metadata = {
  title: "Offline",
  description: "AI Market Cap is temporarily unavailable offline.",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
        Offline
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        You are offline right now.
      </h1>
      <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
        AI Market Cap could not reach the network. Reconnect and refresh to load
        live rankings, marketplace listings, and model pricing.
      </p>
    </main>
  );
}
