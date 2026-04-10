const STALE_PROVISIONING_MINUTES = 20;

type DeploymentOpsRow = {
  id: string;
  model_slug: string;
  model_name: string;
  provider_name: string | null;
  status: "provisioning" | "ready" | "paused" | "failed";
  deployment_kind: "managed_api" | "assistant_only" | "hosted_external";
  created_at: string;
  updated_at: string;
  last_error_message: string | null;
};

function minutesSince(iso: string, nowMs: number) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((nowMs - timestamp) / 60000);
}

export function computeDeploymentOperationsSummary(
  rows: DeploymentOpsRow[],
  now = new Date()
) {
  const nowMs = now.getTime();
  const staleProvisioning = rows.filter((row) => {
    if (row.status !== "provisioning") return false;
    const minutes = minutesSince(row.updated_at, nowMs);
    return minutes != null && minutes >= STALE_PROVISIONING_MINUTES;
  });

  const failed = rows.filter((row) => row.status === "failed");

  return {
    totals: {
      total: rows.length,
      managedCount: rows.filter((row) => row.deployment_kind === "managed_api").length,
      hostedCount: rows.filter((row) => row.deployment_kind === "hosted_external").length,
      readyCount: rows.filter((row) => row.status === "ready").length,
      pausedCount: rows.filter((row) => row.status === "paused").length,
      provisioningCount: rows.filter((row) => row.status === "provisioning").length,
      staleProvisioningCount: staleProvisioning.length,
      failedCount: failed.length,
      staleProvisioningThresholdMinutes: STALE_PROVISIONING_MINUTES,
    },
    recentStaleProvisioning: staleProvisioning.slice(0, 10).map((row) => ({
      id: row.id,
      slug: row.model_slug,
      modelName: row.model_name,
      provider: row.provider_name,
      deploymentKind: row.deployment_kind,
      updatedAt: row.updated_at,
      ageMinutes: minutesSince(row.updated_at, nowMs),
    })),
    recentFailed: failed.slice(0, 10).map((row) => ({
      id: row.id,
      slug: row.model_slug,
      modelName: row.model_name,
      provider: row.provider_name,
      deploymentKind: row.deployment_kind,
      updatedAt: row.updated_at,
      errorMessage: row.last_error_message,
    })),
  };
}
