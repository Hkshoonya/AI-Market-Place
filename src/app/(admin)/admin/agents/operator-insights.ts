export function describeRunningDuration(
  startedAt: string | null | undefined,
  createdAt: string,
  now = Date.now()
) {
  const anchor = startedAt ?? createdAt;
  const startedMs = new Date(anchor).getTime();
  if (Number.isNaN(startedMs)) return "unknown duration";

  const elapsedMs = Math.max(0, now - startedMs);
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getIssueVerificationSummary(
  verification: Record<string, unknown> | null | undefined
) {
  if (!verification) return null;

  const reason =
    typeof verification.reason === "string"
      ? verification.reason
      : typeof verification.message === "string"
        ? verification.message
        : null;
  const status =
    typeof verification.status === "string" ? verification.status : null;

  if (!reason && !status) return null;

  return {
    reason,
    status,
  };
}
