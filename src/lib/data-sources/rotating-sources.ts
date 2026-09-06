/** Reserve capacity for new releases while giving the long tail a durable turn. */
export function selectRotatingSources<T extends { id: string }>(
  newestFirst: T[],
  limit: number,
  cursor: string | null
): { sources: T[]; nextCursor: string | null } {
  const budget = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (budget === 0 || newestFirst.length === 0) return { sources: [], nextCursor: cursor };
  if (newestFirst.length <= budget) return { sources: newestFirst, nextCursor: null };

  const priority = newestFirst.slice(0, Math.floor(budget / 5));
  const priorityIds = new Set(priority.map((source) => source.id));
  const remaining = newestFirst.filter((source) => !priorityIds.has(source.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const afterCursor = cursor ? remaining.findIndex((source) => source.id.localeCompare(cursor) > 0) : 0;
  const start = afterCursor < 0 ? 0 : afterCursor;
  const rotated = [...remaining.slice(start), ...remaining.slice(0, start)]
    .slice(0, budget - priority.length);
  return { sources: [...priority, ...rotated], nextCursor: rotated.at(-1)?.id ?? null };
}
