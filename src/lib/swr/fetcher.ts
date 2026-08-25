/**
 * Shared JSON fetcher for SWR.
 * Handles non-OK responses by throwing an error with the HTTP status attached.
 */
export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
  });

  if (!res.ok) {
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown; message?: unknown } | null;
    const serverMessage =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.message === "string"
          ? body.message
          : null;
    const error = new Error(
      serverMessage ?? `Fetch error: ${res.status} ${res.statusText}`
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}
