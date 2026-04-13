import { render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("link", { name: /Browse deployable models/i })).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /Browse deployable models/i })).toBeInTheDocument();
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
});
