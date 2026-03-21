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

export function describeIssuePlaybook(
  playbook: string | null | undefined,
  issueType: string | null | undefined
) {
  if (playbook === "cleanup_stale_task" || issueType === "stale_running_task") {
    return {
      label: "Stale task recovery",
      summary:
        "Cancel the stale run, verify no duplicate work remains, and requeue the agent if needed.",
      action:
        "Check runtime evidence, clear the stuck task, then confirm the next scheduled run succeeds.",
    };
  }

  if (playbook === "review_failed_run" || issueType === "failing_cron_run") {
    return {
      label: "Failed run review",
      summary:
        "Review the failed run output, confirm whether the failure is transient, and retry once the dependency is healthy.",
      action:
        "Inspect logs, validate the dependency state, and capture the retry decision in the operator ledger.",
    };
  }

  return {
    label: "Manual investigation",
    summary: "No automatic playbook is attached to this issue yet.",
    action:
      "Review the issue evidence, confirm impact, and capture the recovery steps in the operator ledger.",
  };
}
