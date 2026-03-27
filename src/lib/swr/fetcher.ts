/**
 * Shared JSON fetcher for SWR.
 * Handles non-OK responses by throwing an error with the HTTP status attached.
 */
export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
  });

  if (!res.ok) {
    const error = new Error(
      `Fetch error: ${res.status} ${res.statusText}`
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}
