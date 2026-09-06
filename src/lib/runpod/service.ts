import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from "@/lib/provider-connections/crypto";
import { getProviderConnectionSecret } from "@/lib/provider-connections/server";
import type { RunpodPodRecord } from "@/types/database";
import { getRunpodModel, type PublicRunpodPod } from "./catalog";
import {
  createRunpodPod,
  controlRunpodPod,
  findRunpodPod,
  getRunpodAccount,
  getRunpodGpus,
  isRunpodApiReady,
  podEndpoint,
  RunpodError,
  type RunpodRemotePod,
} from "./client";

// vLLM v0.28.0, verified against the official Docker registry 2026-09-06.
export const RUNPOD_IMAGE =
  "vllm/vllm-openai@sha256:61fc8a896b0a4fbbbdc063bc4b0dbc25ce98e02b5050c24aeb7830ac02039b14";
export function runpodLaunchEnabled() {
  return process.env.RUNPOD_PODS_ENABLED === "true";
}
function requireLaunchEnabled() {
  if (!runpodLaunchEnabled())
    throw new RunpodError(
      "Pod launches are awaiting live deployment verification. No resources were created.",
      503,
    );
}

export function publicPod(row: RunpodPodRecord): PublicRunpodPod {
  return {
    id: row.id,
    modelKey: row.model_key,
    modelName: getRunpodModel(row.model_key)?.name ?? row.model_key,
    gpuName: row.gpu_name,
    volumeGb: row.volume_gb,
    estimatedGpuPricePerHour: Number(row.gpu_price_per_hr),
    observedPricePerHour:
      row.observed_price_per_hr == null
        ? null
        : Number(row.observed_price_per_hr),
    status: row.status,
    apiReady: row.api_ready,
    endpointUrl:
      row.external_pod_id && row.status !== "terminated"
        ? podEndpoint(row.external_pod_id)
        : null,
    consoleUrl: "https://console.runpod.io/pods",
    quoteExpiresAt: row.quote_expires_at,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

export async function loadOwnedPod(userId: string, id: string) {
  const { data, error } = await createAdminClient()
    .from("runpod_pods")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new RunpodError("Pod not found", 404);
  return data as RunpodPodRecord;
}

async function updatePod(
  row: RunpodPodRecord,
  patch: Partial<RunpodPodRecord>,
  operationId?: string,
) {
  let query = createAdminClient()
    .from("runpod_pods")
    .update(patch)
    .eq("id", row.id)
    .eq("user_id", row.user_id);
  if (operationId) query = query.eq("operation_id", operationId);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data as RunpodPodRecord;
}

async function credential(
  userId: string,
  connectionId: string | null,
  expectedAccount?: string,
) {
  if (!connectionId)
    throw new RunpodError("Reconnect your Runpod account", 409);
  const connection = await getProviderConnectionSecret({
    connectionId,
    userId,
    expectedProvider: "runpod",
  });
  const accountId = await getRunpodAccount(connection.secret);
  if (expectedAccount && expectedAccount !== accountId)
    throw new RunpodError(
      "Runpod account has changed. Reconnect the original account to manage this Pod.",
      409,
    );
  return { token: connection.secret, accountId };
}

export async function quoteRunpodPod(
  userId: string,
  input: {
    connectionId: string;
    modelKey: string;
    gpuTypeId: string;
    volumeGb: number;
  },
) {
  const model = getRunpodModel(input.modelKey);
  if (!model)
    throw new RunpodError(
      "This model is not in the reviewed Pod launch catalog",
      400,
    );
  const { token, accountId } = await credential(userId, input.connectionId);
  const gpu = (await getRunpodGpus(token, input.volumeGb)).find(
    (item) =>
      item.id === input.gpuTypeId && item.memoryGb >= model.minimumVramGb,
  );
  if (!gpu)
    throw new RunpodError(
      "This GPU is no longer available or does not fit the model. Refresh the GPU list.",
      409,
    );
  const admin = createAdminClient();
  const { error: cleanupError } = await admin
    .from("runpod_pods")
    .delete()
    .eq("user_id", userId)
    .eq("status", "quoted")
    .lt("quote_expires_at", new Date().toISOString());
  if (cleanupError) throw cleanupError;
  const { data, error } = await admin
    .from("runpod_pods")
    .insert({
      user_id: userId,
      provider_connection_id: input.connectionId,
      external_account_id: accountId,
      model_key: model.key,
      gpu_type_id: gpu.id,
      gpu_name: gpu.name,
      gpu_memory_gb: gpu.memoryGb,
      volume_gb: input.volumeGb,
      gpu_price_per_hr: gpu.pricePerHour,
      image_name: RUNPOD_IMAGE,
      encrypted_api_key: encryptProviderSecret(
        randomBytes(32).toString("base64url"),
      ),
      quote_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return publicPod(data as RunpodPodRecord);
}

function assertRemoteOwner(row: RunpodPodRecord, remote: RunpodRemotePod) {
  if (
    remote.consumerUserId !== row.external_account_id ||
    remote.name !== `aimc-${row.id}` ||
    (row.external_pod_id && remote.id !== row.external_pod_id)
  ) {
    throw new RunpodError(
      "Runpod resource identity could not be verified. Review it in the Runpod console.",
      409,
    );
  }
}

export async function launchRunpodPod(userId: string, id: string) {
  let row = await loadOwnedPod(userId, id);
  // Idempotent even if the first HTTP response was lost.
  if (row.status !== "quoted") return publicPod(row);
  requireLaunchEnabled();
  if (Date.parse(row.quote_expires_at) <= Date.now())
    throw new RunpodError(
      "Estimate expired. Request a new estimate before launching.",
      409,
    );
  const { token } = await credential(
    userId,
    row.provider_connection_id,
    row.external_account_id,
  );
  const gpu = (await getRunpodGpus(token, row.volume_gb)).find(
    (item) => item.id === row.gpu_type_id,
  );
  if (!gpu || gpu.pricePerHour > Number(row.gpu_price_per_hr))
    throw new RunpodError(
      "GPU availability or pricing changed. Request a new estimate.",
      409,
    );
  if (row.image_name !== RUNPOD_IMAGE || !getRunpodModel(row.model_key))
    throw new RunpodError(
      "Launch configuration changed. Request a new estimate.",
      409,
    );
  const apiKey = decryptProviderSecret(row.encrypted_api_key);
  const { data: claimed, error } = await createAdminClient().rpc(
    "claim_runpod_quote",
    { p_id: id, p_user_id: userId },
  );
  if (error) throw error;
  if (!claimed)
    throw new RunpodError(
      "Estimate already consumed, expired, or the three-Pod account limit was reached. Refresh your Pods.",
      409,
    );
  row = { ...row, status: "creating" };
  try {
    const remote = await createRunpodPod(token, {
      id: row.id,
      modelKey: row.model_key,
      gpuTypeId: row.gpu_type_id,
      volumeGb: row.volume_gb,
      imageName: row.image_name,
      apiKey,
    });
    assertRemoteOwner(row, remote);
    return publicPod(
      await updatePod(row, {
        external_pod_id: remote.id,
        status: "starting",
        last_checked_at: new Date().toISOString(),
        observed_price_per_hr:
          remote.adjustedCostPerHr ?? remote.costPerHr ?? null,
        last_error: null,
      }),
    );
  } catch {
    // A provider error or lost response is NOT proof that nothing was billed.
    // Reconcile by our unique name; never automatically POST /pods again.
    return publicPod(
      await updatePod(row, {
        status: "unknown",
        last_error: `Launch outcome is unconfirmed. Refresh status or find aimc-${row.id} in Runpod before trying another launch. Charges may already be accruing.`,
      }),
    );
  }
}

export async function operateRunpodPod(
  userId: string,
  id: string,
  action: "refresh" | "stop" | "resume" | "terminate",
  maxGpuPrice?: number,
) {
  let row = await loadOwnedPod(userId, id);
  if (["quoted", "terminated", "failed"].includes(row.status))
    return publicPod(row);
  if (action === "resume") requireLaunchEnabled();
  if (
    row.status === "creating" &&
    Date.now() - Date.parse(row.updated_at) < 60_000
  ) {
    throw new RunpodError(
      "Launch is still being confirmed. Wait a minute before refreshing.",
      409,
    );
  }
  const operationId = randomUUID();
  const now = new Date().toISOString();
  const { data: locked, error: lockError } = await createAdminClient()
    .from("runpod_pods")
    .update({
      operation_id: operationId,
      operation_expires_at: new Date(Date.now() + 120_000).toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .or(`operation_expires_at.is.null,operation_expires_at.lt.${now}`)
    .select("*")
    .maybeSingle();
  if (lockError) throw lockError;
  if (!locked)
    throw new RunpodError(
      "Another Pod operation is in progress. Refresh shortly.",
      409,
    );
  row = locked as RunpodPodRecord;
  try {
    const { token } = await credential(
      userId,
      row.provider_connection_id,
      row.external_account_id,
    );
    const remote = await findRunpodPod(token, {
      id: row.external_pod_id ?? undefined,
      name: `aimc-${row.id}`,
    });
    if (!remote) {
      if (!row.external_pod_id) {
        return publicPod(
          await updatePod(
            row,
            {
              status: "unknown",
              api_ready: false,
              last_checked_at: now,
              last_error: `No matching Pod found yet. Check aimc-${row.id} in Runpod; this launch will not be retried automatically.`,
            },
            operationId,
          ),
        );
      }
      return publicPod(
        await updatePod(
          row,
          {
            status: "terminated",
            api_ready: false,
            last_checked_at: now,
            last_error: null,
          },
          operationId,
        ),
      );
    }
    assertRemoteOwner(row, remote);
    row = await updatePod(row, { external_pod_id: remote.id }, operationId);
    if (remote.desiredStatus === "TERMINATED") {
      return publicPod(
        await updatePod(
          row,
          {
            status: "terminated",
            api_ready: false,
            last_checked_at: now,
            last_error: null,
          },
          operationId,
        ),
      );
    }
    if (action === "refresh") {
      const running = remote.desiredStatus === "RUNNING";
      const ready =
        running &&
        (await isRunpodApiReady(
          remote.id,
          decryptProviderSecret(row.encrypted_api_key),
          row.model_key,
        ));
      return publicPod(
        await updatePod(
          row,
          {
            status: running ? "running" : "stopped",
            api_ready: ready,
            last_checked_at: now,
            last_error: null,
            observed_price_per_hr:
              remote.adjustedCostPerHr ?? remote.costPerHr ?? null,
          },
          operationId,
        ),
      );
    }
    if (action === "resume") {
      if (remote.desiredStatus !== "EXITED")
        throw new RunpodError("Only a stopped Pod can be resumed", 409);
      const gpu = (await getRunpodGpus(token, row.volume_gb)).find(
        (item) => item.id === row.gpu_type_id,
      );
      if (!gpu || !maxGpuPrice || gpu.pricePerHour > maxGpuPrice)
        throw new RunpodError(
          "Resume price or availability changed. Review the price in Runpod before resuming.",
          409,
        );
    }
    row = await updatePod(
      row,
      {
        status:
          action === "stop"
            ? "stopping"
            : action === "resume"
              ? "starting"
              : "terminating",
        api_ready: false,
        last_error:
          "Operation requested. Runpod may continue billing until its status is confirmed.",
      },
      operationId,
    );
    await controlRunpodPod(token, remote.id, action);
    return publicPod(
      await updatePod(
        row,
        {
          status:
            action === "terminate"
              ? "terminated"
              : action === "stop"
                ? "stopping"
                : "starting",
          api_ready: false,
          last_checked_at: now,
          last_error:
            action === "terminate"
              ? null
              : "Request accepted. Refresh to confirm the provider status.",
        },
        operationId,
      ),
    );
  } finally {
    const { error } = await createAdminClient()
      .from("runpod_pods")
      .update({ operation_id: null, operation_expires_at: null })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("operation_id", operationId);
    if (error)
      console.warn("Runpod operation lock will expire automatically", {
        podRecordId: id,
      });
  }
}

export async function revealRunpodApiKey(userId: string, id: string) {
  const row = await loadOwnedPod(userId, id);
  if (
    !row.external_pod_id ||
    ["terminated", "quoted", "failed"].includes(row.status)
  )
    throw new RunpodError("Pod API credentials are unavailable", 409);
  return {
    apiKey: decryptProviderSecret(row.encrypted_api_key),
    endpointUrl: podEndpoint(row.external_pod_id),
    model: row.model_key,
  };
}
