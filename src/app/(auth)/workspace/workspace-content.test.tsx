import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceContent from "./workspace-content";

const mockUseSWR = vi.fn();
const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockPush = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/workspace",
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock("@/components/workspace/workspace-start-recommendation", () => ({
  WorkspaceStartRecommendation: () => (
    <div data-testid="workspace-start-recommendation">Recommendation</div>
  ),
}));

function createWorkspaceValue(overrides?: Record<string, unknown>) {
  return {
    open: true,
    minimized: false,
    maximized: false,
    activePanel: "setup",
    persistenceStatus: "saved",
    session: {
      model: "Kimi K2",
      modelSlug: "kimi-k2",
      provider: "Moonshot",
      action: "Open guided setup",
      nextUrl: "https://provider.example/setup",
      suggestedAmount: null,
      suggestedPack: null,
      suggestedPackSlug: null,
      sponsored: false,
      autoStartDeployment: false,
      conversationId: "conv_123",
      runtimeId: null,
      runtimeEndpointPath: null,
      deploymentId: null,
      deploymentEndpointPath: null,
      events: [],
    },
    openWorkspace: vi.fn(),
    minimizeWorkspace: vi.fn(),
    expandWorkspace: vi.fn(),
    maximizeWorkspace: vi.fn(),
    restoreWorkspace: vi.fn(),
    setActivePanel: vi.fn(),
    closeWorkspace: vi.fn(),
    addWorkspaceEvent: vi.fn(),
    updateWorkspaceSession: vi.fn(),
    ...overrides,
  };
}

describe("WorkspaceContent", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    mockUseSWR.mockImplementation((key: string | null) => {
      if (!key) {
        return { data: undefined, mutate: vi.fn() };
      }

      if (key === "/api/workspace/deployments") {
        return {
          data: { deployments: [] },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/deployment")) {
        return {
          data: {
            deployment: null,
            runtime: null,
            provisioning: {
              canCreate: true,
              deploymentKind: "hosted_external",
              label: "AI Market Cap dedicated runtime",
              summary: "Create one saved site setup so budget, usage, and requests stay attached to this workspace.",
              target: null,
            },
          },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/runtime")) {
        return {
          data: { runtime: null },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/chat")) {
        return {
          data: { messages: [] },
          mutate: vi.fn(),
        };
      }

      if (key === "/api/api-keys") {
        return {
          data: { keys: [] },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/marketplace/wallet")) {
        return {
          data: { balance: 0 },
          mutate: vi.fn(),
        };
      }

      return { data: undefined, mutate: vi.fn() };
    });
  });

  it("shows the empty workspace state when the user is signed in without an active session", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
    });
    mockUseWorkspace.mockReturnValue(
      createWorkspaceValue({
        session: null,
      })
    );

    render(<WorkspaceContent />);

    expect(screen.getByText(/No active workspace yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start guided setup/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse launch directory/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Deployments/i })).toBeInTheDocument();
  });

  it("prioritizes saved deployments when the user has no active workspace session", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
    });
    mockUseWorkspace.mockReturnValue(
      createWorkspaceValue({
        session: null,
      })
    );
    mockUseSWR.mockImplementation((key: string | null) => {
      if (!key) {
        return { data: undefined, mutate: vi.fn() };
      }

      if (key === "/api/workspace/deployments") {
        return {
          data: {
            deployments: [
              {
                id: "dep_123",
                modelSlug: "kimi-k2",
                modelName: "Kimi K2",
                status: "ready",
              },
            ],
          },
          mutate: vi.fn(),
        };
      }

      return { data: undefined, mutate: vi.fn() };
    });

    render(<WorkspaceContent />);

    expect(screen.getByText(/You already have saved deployments/i)).toBeInTheDocument();
    expect(screen.getByText(/You already have 1 managed deployment attached to your account/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Deployments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start another guided setup/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse launch directory/i })).toBeInTheDocument();
  });

  it("shows the broader deployment portfolio when the signed-in workspace already has saved deployments", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
    });
    mockUseWorkspace.mockReturnValue(createWorkspaceValue());
    mockUseSWR.mockImplementation((key: string | null) => {
      if (!key) {
        return { data: undefined, mutate: vi.fn() };
      }

      if (key === "/api/workspace/deployments") {
        return {
          data: {
            deployments: [
              {
                id: "dep_1",
                modelSlug: "kimi-k2",
                modelName: "Kimi K2",
                status: "ready",
              },
              {
                id: "dep_2",
                modelSlug: "claude-opus-4-6",
                modelName: "Claude Opus 4.6",
                status: "paused",
              },
              {
                id: "dep_3",
                modelSlug: "grok-4",
                modelName: "Grok 4",
                status: "failed",
              },
              {
                id: "dep_4",
                modelSlug: "gemini-2-5-pro",
                modelName: "Gemini 2.5 Pro",
                status: "provisioning",
              },
            ],
          },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/deployment")) {
        return {
          data: {
            deployment: null,
            runtime: null,
            provisioning: {
              canCreate: true,
              deploymentKind: "hosted_external",
              label: "AI Market Cap dedicated runtime",
              summary:
                "Create one saved site setup so budget, usage, and requests stay attached to this workspace.",
              target: null,
            },
          },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/runtime")) {
        return {
          data: { runtime: null },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/chat")) {
        return {
          data: { messages: [] },
          mutate: vi.fn(),
        };
      }

      if (key === "/api/api-keys") {
        return {
          data: { keys: [] },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/marketplace/wallet")) {
        return {
          data: { balance: 0 },
          mutate: vi.fn(),
        };
      }

      return { data: undefined, mutate: vi.fn() };
    });

    render(<WorkspaceContent />);

    expect(screen.getByText(/Deployment portfolio/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Account-wide deployment status/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Kimi K2 is already saved here with status ready/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/4 saved/i)).toBeInTheDocument();
    expect(screen.getByText(/1 ready/i)).toBeInTheDocument();
    expect(screen.getByText(/1 paused/i)).toBeInTheDocument();
    expect(screen.getByText(/1 need attention/i)).toBeInTheDocument();
    expect(screen.getByText(/1 provisioning/i)).toBeInTheDocument();
    expect(screen.getByText(/3 other workflows/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Deployments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start another guided setup/i })).toBeInTheDocument();
  });

  it("surfaces top-level live deployment controls when the workspace deployment is already active", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
    });
    mockUseWorkspace.mockReturnValue(createWorkspaceValue());
    mockUseSWR.mockImplementation((key: string | null) => {
      if (!key) {
        return { data: undefined, mutate: vi.fn() };
      }

      if (key === "/api/workspace/deployments") {
        return {
          data: {
            deployments: [
              {
                id: "dep_live",
                modelSlug: "kimi-k2",
                modelName: "Kimi K2",
                status: "ready",
              },
            ],
          },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/deployment")) {
        return {
          data: {
            deployment: {
              id: "dep_live",
              runtimeId: "rt_123",
              modelSlug: "kimi-k2",
              modelName: "Kimi K2",
              providerName: "Moonshot",
              status: "ready",
              endpointSlug: "kimi-k2-live",
              endpointPath: "/api/deployments/kimi-k2-live",
              deploymentKind: "hosted_external",
              deploymentLabel: "Dedicated runtime",
              target: null,
              creditsBudget: 40,
              monthlyPriceEstimate: 40,
              totalRequests: 17,
              totalTokens: 4100,
              lastUsedAt: null,
              updatedAt: "2026-04-13T00:00:00.000Z",
              execution: {
                available: true,
                mode: "native_model",
                provider: "Moonshot",
                model: "Kimi K2",
                label: "Dedicated runtime",
                summary: "Runs from a dedicated runtime while staying usable from AI Market Cap.",
              },
              billing: {
                requestCharge: 0.12,
                estimatedSpend: 3.4,
                budgetRemaining: 21.5,
                budgetStatus: "healthy",
              },
            },
            runtime: {
              id: "rt_123",
              modelSlug: "kimi-k2",
              modelName: "Kimi K2",
              providerName: "Moonshot",
              status: "ready",
              endpointSlug: "kimi-k2-runtime",
              endpointPath: "/api/runtime/kimi-k2-runtime",
              assistantPath: "/api/runtime/kimi-k2-runtime/assistant",
              totalRequests: 17,
              totalTokens: 4100,
              lastUsedAt: null,
              updatedAt: "2026-04-13T00:00:00.000Z",
              execution: {
                available: true,
                mode: "native_model",
                provider: "Moonshot",
                model: "Kimi K2",
                label: "Dedicated runtime",
                summary: "Runs from a dedicated runtime while staying usable from AI Market Cap.",
              },
            },
            provisioning: {
              canCreate: true,
              deploymentKind: "hosted_external",
              label: "Dedicated runtime",
              summary: "Create one saved site setup so budget, usage, and requests stay attached to this workspace.",
              target: null,
            },
          },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/runtime")) {
        return {
          data: {
            runtime: {
              id: "rt_123",
              modelSlug: "kimi-k2",
              modelName: "Kimi K2",
              providerName: "Moonshot",
              status: "ready",
              endpointSlug: "kimi-k2-runtime",
              endpointPath: "/api/runtime/kimi-k2-runtime",
              assistantPath: "/api/runtime/kimi-k2-runtime/assistant",
              totalRequests: 17,
              totalTokens: 4100,
              lastUsedAt: null,
              updatedAt: "2026-04-13T00:00:00.000Z",
              execution: {
                available: true,
                mode: "native_model",
                provider: "Moonshot",
                model: "Kimi K2",
                label: "Dedicated runtime",
                summary: "Runs from a dedicated runtime while staying usable from AI Market Cap.",
              },
            },
          },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/workspace/chat")) {
        return {
          data: { messages: [] },
          mutate: vi.fn(),
        };
      }

      if (key === "/api/api-keys") {
        return {
          data: { keys: [] },
          mutate: vi.fn(),
        };
      }

      if (key.startsWith("/api/marketplace/wallet")) {
        return {
          data: { balance: 25 },
          mutate: vi.fn(),
        };
      }

      return { data: undefined, mutate: vi.fn() };
    });

    render(<WorkspaceContent />);

    expect(screen.getByText(/Live deployment controls/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Endpoint, quick test, budget, and traffic controls are active/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("/api/deployments/kimi-k2-live").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /Run quick test/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage budget/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pause deployment now/i })).toBeInTheDocument();
    expect(screen.getAllByText(/\$21\.50 left/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Live operations/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/17 requests/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/4100 tokens/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Workspace snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/Maintenance actions/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pause Deployment$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open deployments/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Show workflow guide/i })).toBeInTheDocument();
    expect(screen.getByText(/Run selected model/i)).toBeInTheDocument();
  });

  it("renders explicit full-page workflow controls and lets the guide collapse", async () => {
    const user = userEvent.setup();
    const workspaceValue = createWorkspaceValue();

    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
    });
    mockUseWorkspace.mockReturnValue(workspaceValue);

    render(<WorkspaceContent />);

    expect(screen.getByRole("button", { name: /Hide Floating Console/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Floating Console/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Minimize Floating Console/i })).toBeInTheDocument();
    expect(screen.getByText(/Workspace navigator/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Workflow guide$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Quick test$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open assistant view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open usage history/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide workflow guide/i })).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open API keys/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create site setup/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Open Floating Console/i }));
    expect(workspaceValue.maximizeWorkspace).toHaveBeenCalled();
    expect(workspaceValue.setActivePanel).toHaveBeenCalledWith("setup");

    await user.click(screen.getByRole("button", { name: /Minimize Floating Console/i }));
    expect(workspaceValue.minimizeWorkspace).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Hide workflow guide/i }));
    expect(screen.getByRole("button", { name: /Show workflow guide/i })).toBeInTheDocument();
  });

  it("lets the workspace navigator switch directly between setup, assistant, and usage views", async () => {
    const user = userEvent.setup();

    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
    });
    mockUseWorkspace.mockReturnValue(createWorkspaceValue());

    render(<WorkspaceContent />);

    expect(screen.getByRole("tab", { name: /Setup/i })).toHaveAttribute("data-state", "active");

    await user.click(screen.getByRole("button", { name: /Open assistant view/i }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Assistant/i })).toHaveAttribute("data-state", "active")
    );
    expect(screen.getByText(/Quick prompts/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Open usage history/i }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Usage/i })).toHaveAttribute("data-state", "active")
    );
    expect(screen.getByText(/Recent snapshot/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Workflow guide$/i }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Setup/i })).toHaveAttribute("data-state", "active")
    );
    expect(screen.getByRole("button", { name: /Save note/i })).toBeInTheDocument();
  });
});
