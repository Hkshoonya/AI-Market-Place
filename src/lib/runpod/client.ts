import "server-only";

import { z } from "zod";
import { getRunpodModel, RUNPOD_CONTAINER_GB, type RunpodGpu } from "./catalog";
import { runpodBootstrap } from "./gateway";

const REST_BASE = "https://rest.runpod.io/v1";
const GRAPHQL = "https://api.runpod.io/graphql";
const PodId = z.string().regex(/^[a-zA-Z0-9]{5,64}$/);
const Price = z
  .union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite().nonnegative());
export const PodSchema = z.object({
  id: PodId,
  name: z.string(),
  consumerUserId: z.string(),
  desiredStatus: z.enum(["RUNNING", "EXITED", "TERMINATED"]),
  costPerHr: Price.nullish(),
  adjustedCostPerHr: Price.nullish(),
});
export type RunpodRemotePod = z.infer<typeof PodSchema>;

export class RunpodError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

async function request(
  token: string,
  path: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`${REST_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  // Never echo provider bodies: they can contain credentials or container env.
  if (!response.ok)
    throw new RunpodError(
      `Runpod request failed (HTTP ${response.status}). Check your account permissions, balance and GPU availability in Runpod.`,
      response.status === 404 ? 404 : 502,
    );
  return response;
}

async function graphql(token: string, query: string) {
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data || body.errors?.length) {
    throw new RunpodError(
      "Runpod rejected this credential or its permissions. Allow Pod management and account read access.",
      422,
    );
  }
  return body.data as unknown;
}

export async function getRunpodAccount(token: string) {
  if (!token.trim())
    throw new RunpodError("Runpod rejected this credential", 422);
  const result = await graphql(token, "query { myself { id } }");
  return z.object({ myself: z.object({ id: z.string().min(1) }) }).parse(result)
    .myself.id;
}

export async function getRunpodGpus(
  token: string,
  volumeGb = 30,
): Promise<RunpodGpu[]> {
  const diskGb =
    RUNPOD_CONTAINER_GB +
    z.union([z.literal(30), z.literal(50), z.literal(100)]).parse(volumeGb);
  const result = await graphql(
    token,
    `query { gpuTypes { id displayName memoryInGb secureCloud
    lowestPrice(input: {gpuCount: 1, secureCloud: true, minDisk: ${diskGb}}) {
      stockStatus uninterruptablePrice availableGpuCounts
    } } }`,
  );
  const schema = z.object({
    gpuTypes: z.array(
      z.object({
        id: z.string(),
        displayName: z.string(),
        memoryInGb: z.number(),
        secureCloud: z.boolean(),
        lowestPrice: z
          .object({
            stockStatus: z.string().nullish(),
            uninterruptablePrice: Price.nullish(),
            availableGpuCounts: z.array(z.number()).nullish(),
          })
          .nullish(),
      }),
    ),
  });
  return schema
    .parse(result)
    .gpuTypes.flatMap((gpu) => {
      const price = gpu.lowestPrice;
      if (
        !gpu.secureCloud ||
        gpu.memoryInGb < 24 ||
        gpu.memoryInGb > 80 ||
        !price?.uninterruptablePrice ||
        !["High", "Medium", "Low"].includes(price.stockStatus ?? "") ||
        (price.availableGpuCounts != null &&
          !price.availableGpuCounts.includes(1)) ||
        !/RTX (4090|A5000|A6000|6000 Ada)|A40|L40S|A100|H100/.test(gpu.id)
      )
        return [];
      return [
        {
          id: gpu.id,
          name: gpu.displayName,
          memoryGb: gpu.memoryInGb,
          pricePerHour: price.uninterruptablePrice,
          stock: price.stockStatus!,
        },
      ];
    })
    .sort((a, b) => a.pricePerHour - b.pricePerHour);
}

export function podEndpoint(id: string) {
  return `https://${PodId.parse(id)}-8000.proxy.runpod.net/v1`;
}

export function buildPodPayload(input: {
  id: string;
  modelKey: string;
  gpuTypeId: string;
  volumeGb: number;
  imageName: string;
  apiKey: string;
}) {
  const model = getRunpodModel(input.modelKey);
  if (!model) throw new RunpodError("Unsupported launch model", 400);
  return {
    name: `aimc-${input.id}`,
    cloudType: "SECURE",
    computeType: "GPU",
    gpuTypeIds: [input.gpuTypeId],
    gpuCount: 1,
    gpuTypePriority: "custom",
    imageName: input.imageName,
    interruptible: false,
    allowedCudaVersions: ["13.0"],
    containerDiskInGb: RUNPOD_CONTAINER_GB,
    volumeInGb: input.volumeGb,
    volumeMountPath: "/workspace",
    ports: ["8000/http"],
    supportPublicIp: false,
    env: {
      VLLM_API_KEY: input.apiKey,
      HF_HOME: "/workspace/huggingface",
      PYTHONPATH: "/tmp",
      AIMC_MODEL_KEY: model.key,
    },
    dockerEntrypoint: ["python3", "-c"],
    dockerStartCmd: [
      runpodBootstrap(),
      "--middleware",
      "aimc_guard.Gateway",
      "--disable-fastapi-docs",
      "--model",
      model.repository,
      "--revision",
      model.revision,
      "--served-model-name",
      model.key,
      "--host",
      "0.0.0.0",
      "--port",
      "8000",
      "--max-model-len",
      "8192",
      "--gpu-memory-utilization",
      "0.85",
      "--max-num-seqs",
      "4",
    ],
  };
}

export async function createRunpodPod(
  token: string,
  input: Parameters<typeof buildPodPayload>[0],
) {
  return PodSchema.parse(
    await (
      await request(token, "/pods", "POST", buildPodPayload(input))
    ).json(),
  );
}

export async function findRunpodPod(
  token: string,
  input: { id?: string; name: string },
) {
  if (input.id) {
    try {
      return PodSchema.parse(
        await (await request(token, `/pods/${PodId.parse(input.id)}`)).json(),
      );
    } catch (error) {
      if (error instanceof RunpodError && error.status === 404) return null;
      throw error;
    }
  }
  const pods = z
    .array(PodSchema)
    .parse(
      await (
        await request(token, `/pods?name=${encodeURIComponent(input.name)}`)
      ).json(),
    );
  const matches = pods.filter((pod) => pod.name === input.name);
  if (matches.length > 1)
    throw new RunpodError(
      "Multiple Pods match this launch. Review them in the Runpod console.",
      409,
    );
  return matches[0] ?? null;
}

export async function controlRunpodPod(
  token: string,
  id: string,
  action: "stop" | "resume" | "terminate",
) {
  const path = `/pods/${PodId.parse(id)}`;
  await request(
    token,
    action === "terminate"
      ? path
      : `${path}/${action === "resume" ? "start" : "stop"}`,
    action === "terminate" ? "DELETE" : "POST",
  );
}

export async function isRunpodApiReady(
  id: string,
  key: string,
  modelKey: string,
) {
  try {
    const response = await fetch(`${podEndpoint(id)}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return false;
    const body = z
      .object({ data: z.array(z.object({ id: z.string() })) })
      .safeParse(await response.json());
    return (
      body.success && body.data.data.some((model) => model.id === modelKey)
    );
  } catch {
    return false;
  }
}
