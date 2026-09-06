import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PodsContent from "./pods-content";
import type { PublicRunpodPod } from "@/lib/runpod/catalog";

const m = vi.hoisted(() => ({
  swr: vi.fn(),
  auth: vi.fn(),
  router: vi.fn(),
  mutate: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("swr", () => ({ default: m.swr }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: m.router }),
}));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: m.auth }));
const quote: PublicRunpodPod = {
  id: "11111111-1111-4111-8111-111111111111",
  modelKey: "qwen3-8b",
  modelName: "Qwen3 8B",
  gpuName: "A40",
  volumeGb: 30,
  estimatedGpuPricePerHour: 0.4,
  observedPricePerHour: null,
  status: "quoted",
  apiReady: false,
  endpointUrl: null,
  consoleUrl: "https://console.runpod.io/pods",
  quoteExpiresAt: "2099-01-01T00:00:00Z",
  lastCheckedAt: null,
  lastError: null,
  createdAt: "2026-09-06T12:00:00Z",
};
let snapshot: {
  pods: PublicRunpodPod[];
  connections: Array<{ id: string }>;
  launchEnabled: boolean;
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", m.fetch);
  m.auth.mockReturnValue({ user: { id: "user1" }, loading: false });
  m.mutate.mockResolvedValue(undefined);
  snapshot = {
    pods: [],
    connections: [{ id: "connection1" }],
    launchEnabled: true,
  };
  m.swr.mockImplementation(() => ({
    data: snapshot,
    mutate: m.mutate,
    isLoading: false,
  }));
  m.fetch.mockImplementation(async (_url: string, options?: RequestInit) => {
    if (!options)
      return Response.json({
        gpus: [
          {
            id: "NVIDIA A40",
            name: "A40",
            memoryGb: 48,
            pricePerHour: 0.4,
            stock: "High",
          },
        ],
      });
    const body = JSON.parse(String(options.body));
    if (body.action === "reveal_key")
      return Response.json({ apiKey: "dedicated-test-pod-key" });
    return Response.json({ pod: quote });
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("GPU Pods workspace", () => {
  it("provides a disclosed referral link and does not create resources on account connection", () => {
    snapshot.connections = [];
    render(<PodsContent />);
    expect(
      screen.getByRole("link", { name: /Create Runpod account/ }),
    ).toHaveAttribute("href", "/go/runpod?source=workspace-pods");
    expect(screen.getByText(/may earn Runpod credits/)).toBeInTheDocument();
    expect(
      screen.getByText(/Connecting an account does not launch/),
    ).toBeInTheDocument();
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("requires an estimate and explicit billing consent before launching", async () => {
    const user = userEvent.setup();
    render(<PodsContent />);
    await user.click(screen.getByRole("button", { name: "Load current GPUs" }));
    await user.click(screen.getByRole("button", { name: "Review estimate" }));
    const launch = screen.getByRole("button", {
      name: "Accept charges and launch Pod",
    });
    expect(launch).toBeDisabled();
    expect(
      screen.getByText(/no automatic idle shutdown or hard spending cap/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    await user.click(launch);
    await waitFor(() =>
      expect(m.fetch).toHaveBeenCalledWith(
        "/api/workspace/pods",
        expect.objectContaining({
          body: JSON.stringify({
            action: "launch",
            id: quote.id,
            acceptProviderCharges: true,
          }),
        }),
      ),
    );
  });
  it("keeps launches disabled behind the rollout gate even after consent", async () => {
    snapshot.launchEnabled = false;
    const user = userEvent.setup();
    render(<PodsContent />);
    await user.click(screen.getByRole("button", { name: "Load current GPUs" }));
    await user.click(screen.getByRole("button", { name: "Review estimate" }));
    await user.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", { name: "Accept charges and launch Pod" }),
    ).toBeDisabled();
    expect(screen.getByText(/Launch preview/)).toBeInTheDocument();
  });
  it("invalidates the old estimate when configuration changes", async () => {
    const user = userEvent.setup();
    render(<PodsContent />);
    await user.click(screen.getByRole("button", { name: "Load current GPUs" }));
    await user.click(screen.getByRole("button", { name: "Review estimate" }));
    await user.selectOptions(
      screen.getByLabelText("Persistent Pod volume"),
      "50",
    );
    expect(
      screen.queryByRole("button", { name: "Accept charges and launch Pod" }),
    ).not.toBeInTheDocument();
  });
  it("does not label a billable GPU as a ready model API", () => {
    snapshot.pods = [
      {
        ...quote,
        status: "running",
        endpointUrl: "https://pod12345-8000.proxy.runpod.net/v1",
      },
    ];
    render(<PodsContent />);
    expect(
      screen.getByText(/GPU allocated, but the model API is not ready/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Model API ready")).not.toBeInTheDocument();
  });
  it("shows retained-storage costs and requires destructive confirmation", async () => {
    snapshot.pods = [
      {
        ...quote,
        status: "stopped",
        endpointUrl: "https://pod12345-8000.proxy.runpod.net/v1",
      },
    ];
    const user = userEvent.setup();
    render(<PodsContent />);
    expect(screen.getByText(/Stopped is not deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Terminate" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(m.fetch).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Delete Pod and data" }),
    );
    await waitFor(() =>
      expect(m.fetch).toHaveBeenCalledWith(
        "/api/workspace/pods",
        expect.objectContaining({
          body: JSON.stringify({
            action: "terminate",
            id: quote.id,
            confirmation: "DELETE POD AND DATA",
          }),
        }),
      ),
    );
  });
  it("does not fetch or expose a Pod key until the owner requests it", async () => {
    snapshot.pods = [
      {
        ...quote,
        status: "running",
        endpointUrl: "https://pod12345-8000.proxy.runpod.net/v1",
      },
    ];
    const user = userEvent.setup();
    render(<PodsContent />);
    expect(screen.queryByLabelText("Pod API key")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Reveal Pod API key/ }),
    );
    expect(await screen.findByLabelText("Pod API key")).toHaveTextContent(
      "dedicated-test-pod-key",
    );
    await user.click(screen.getByRole("button", { name: "Hide key" }));
    expect(screen.queryByLabelText("Pod API key")).not.toBeInTheDocument();
  });
  it("does not present a data-load failure as an empty account", () => {
    m.swr.mockReturnValue({ error: new Error("down"), mutate: m.mutate });
    render(<PodsContent />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pods could not be loaded",
    );
    expect(
      screen.queryByText("No Pods launched from AI Market Cap yet."),
    ).not.toBeInTheDocument();
  });
});
