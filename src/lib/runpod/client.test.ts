import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPodPayload,
  controlRunpodPod,
  createRunpodPod,
  findRunpodPod,
  getRunpodAccount,
  getRunpodGpus,
  isRunpodApiReady,
  podEndpoint,
} from "./client";
import { RUNPOD_MODELS } from "./catalog";
import { RUNPOD_IMAGE } from "./service";

afterEach(() => vi.unstubAllGlobals());
const pod = {
  id: "pod12345",
  name: "aimc-test",
  consumerUserId: "acct1",
  desiredStatus: "RUNNING",
  env: { SECRET: "not-public" },
};

describe("Runpod provider client", () => {
  it("uses account-scoped Bearer auth without leaking tokens into URLs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: { myself: { id: "account1" } } }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await getRunpodAccount("sensitive-key")).toBe("account1");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.runpod.io/graphql",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sensitive-key",
        }),
        redirect: "error",
        cache: "no-store",
      }),
    );
  });
  it("fails closed on GraphQL errors and never exposes the upstream message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ errors: [{ message: "secret-token" }] }),
        ),
    );
    await expect(getRunpodAccount("key")).rejects.toThrow(
      "rejected this credential",
    );
  });
  it("filters unsupported GPUs, unavailable stock, absent prices and multi-GPU-only offers", async () => {
    const gpu = {
      id: "NVIDIA A40",
      displayName: "A40",
      memoryInGb: 48,
      secureCloud: true,
      lowestPrice: {
        stockStatus: "High",
        uninterruptablePrice: 0.4,
        availableGpuCounts: [1, 2],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            data: {
              gpuTypes: [
                gpu,
                { ...gpu, memoryInGb: 16 },
                { ...gpu, secureCloud: false },
                { ...gpu, id: "AMD MI300" },
                {
                  ...gpu,
                  lowestPrice: {
                    ...gpu.lowestPrice,
                    uninterruptablePrice: null,
                  },
                },
                {
                  ...gpu,
                  lowestPrice: { ...gpu.lowestPrice, stockStatus: "None" },
                },
                {
                  ...gpu,
                  lowestPrice: { ...gpu.lowestPrice, availableGpuCounts: [2] },
                },
              ],
            },
          }),
        ),
    );
    expect(await getRunpodGpus("key")).toEqual([
      {
        id: gpu.id,
        name: "A40",
        memoryGb: 48,
        pricePerHour: 0.4,
        stock: "High",
      },
    ]);
  });
  it("pins weights and image, protects all routes and never enables remote model code or SSH", () => {
    const payload = buildPodPayload({
      id: "test",
      modelKey: RUNPOD_MODELS[0].key,
      gpuTypeId: "NVIDIA A40",
      volumeGb: 30,
      imageName: RUNPOD_IMAGE,
      apiKey: "pod-key",
    });
    expect(payload.ports).toEqual(["8000/http"]);
    expect(payload.cloudType).toBe("SECURE");
    expect(payload.allowedCudaVersions).toEqual(["13.0"]);
    expect(payload.imageName).toMatch(/@sha256:[a-f0-9]{64}$/);
    expect(payload.dockerStartCmd).toContain(RUNPOD_MODELS[0].revision);
    expect(payload.dockerStartCmd).toContain("aimc_guard.Gateway");
    expect(payload.dockerStartCmd).not.toContain("--trust-remote-code");
    expect(payload.env.VLLM_API_KEY).toBe("pod-key");
    expect(payload.gpuCount).toBe(1);
  });
  it("accepts a priced single-GPU query when Runpod omits optional availableGpuCounts", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            data: {
              gpuTypes: [
                {
                  id: "NVIDIA A40",
                  displayName: "A40",
                  memoryInGb: 48,
                  secureCloud: true,
                  lowestPrice: {
                    stockStatus: "Low",
                    uninterruptablePrice: 0.49,
                    availableGpuCounts: null,
                  },
                },
              ],
            },
          }),
        ),
    );
    expect(await getRunpodGpus("key")).toHaveLength(1);
  });
  it("rejects arbitrary model references and crafted endpoint hostnames", () => {
    expect(() =>
      buildPodPayload({
        id: "id",
        modelKey: "evil/repo",
        gpuTypeId: "A40",
        volumeGb: 30,
        imageName: RUNPOD_IMAGE,
        apiKey: "key",
      }),
    ).toThrow();
    for (const id of ["../secret", "x.evil.com/", "localhost", "abc?"]) {
      if (id === "localhost")
        expect(podEndpoint(id)).toBe(
          "https://localhost-8000.proxy.runpod.net/v1",
        );
      else expect(() => podEndpoint(id)).toThrow();
    }
  });
  it("makes exactly one create call and strips remote env fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(pod));
    vi.stubGlobal("fetch", fetcher);
    const result = await createRunpodPod("key", {
      id: "test",
      modelKey: RUNPOD_MODELS[0].key,
      gpuTypeId: "A40",
      volumeGb: 30,
      imageName: RUNPOD_IMAGE,
      apiKey: "api-secret",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty("env");
  });
  it("never retries a timed-out launch", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      createRunpodPod("key", {
        id: "test",
        modelKey: RUNPOD_MODELS[0].key,
        gpuTypeId: "A40",
        volumeGb: 30,
        imageName: RUNPOD_IMAGE,
        apiKey: "api-secret",
      }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses documented lifecycle paths and treats deletion errors as unconfirmed", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );
    vi.stubGlobal("fetch", fetcher);
    await controlRunpodPod("key", "pod12345", "resume");
    await controlRunpodPod("key", "pod12345", "stop");
    await controlRunpodPod("key", "pod12345", "terminate");
    expect(
      fetcher.mock.calls.map(([url, options]) => [url, options.method]),
    ).toEqual([
      ["https://rest.runpod.io/v1/pods/pod12345/start", "POST"],
      ["https://rest.runpod.io/v1/pods/pod12345/stop", "POST"],
      ["https://rest.runpod.io/v1/pods/pod12345", "DELETE"],
    ]);
  });
  it("refuses ambiguous name recovery rather than managing an arbitrary Pod", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json([pod, { ...pod, id: "pod67890" }])),
    );
    await expect(findRunpodPod("key", { name: "aimc-test" })).rejects.toThrow(
      "Multiple Pods",
    );
  });
  it("checks readiness only at the fixed Runpod proxy with a Pod key and no redirects", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await isRunpodApiReady("pod12345", "pod-key", "qwen3-8b")).toBe(
      false,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://pod12345-8000.proxy.runpod.net/v1/models",
      expect.objectContaining({
        redirect: "error",
        headers: { Authorization: "Bearer pod-key" },
      }),
    );
  });
  it("only declares readiness when the authenticated endpoint serves the expected model", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ data: [{ id: "wrong-model" }] }))
        .mockResolvedValueOnce(Response.json({ data: [{ id: "qwen3-8b" }] })),
    );
    expect(await isRunpodApiReady("pod12345", "pod-key", "qwen3-8b")).toBe(
      false,
    );
    expect(await isRunpodApiReady("pod12345", "pod-key", "qwen3-8b")).toBe(
      true,
    );
  });
});
