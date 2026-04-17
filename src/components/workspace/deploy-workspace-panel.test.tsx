import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DeployWorkspacePanel } from "./deploy-workspace-panel";

const mockUseSWR = vi.fn();
const mockUseAuth = vi.fn();
const mockUseOptionalWorkspace = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("./workspace-provider", () => ({
  useOptionalWorkspace: () => mockUseOptionalWorkspace(),
}));

vi.mock("./workspace-start-recommendation", () => ({
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

describe("DeployWorkspacePanel", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
    });

    mockUseSWR.mockImplementation((key: string | null) => {
      if (!key) {
        return { data: undefined, mutate: vi.fn() };
      }

      if (key.startsWith("/api/workspace/deployment")) {
        return {
          data: {
            deployment: null,
            provisioning: {
              canCreate: true,
              deploymentKind: "hosted_external",
              label: "AI Market Cap dedicated runtime",
              summary: "Create the site-hosted setup after funding and API access are ready.",
              target: null,
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
          data: { balance: 0 },
          mutate: vi.fn(),
        };
      }

      return { data: undefined, mutate: vi.fn() };
    });
  });

  it("renders the minimized launcher when the panel is collapsed", () => {
    mockUseOptionalWorkspace.mockReturnValue(
      createWorkspaceValue({
        minimized: true,
      })
    );

    render(<DeployWorkspacePanel />);

    expect(screen.getByRole("button", { name: /Open Kimi K2 workflow/i })).toBeInTheDocument();
  });

  it("renders explicit workflow controls and step labels in the expanded panel", async () => {
    const user = userEvent.setup();
    mockUseOptionalWorkspace.mockReturnValue(createWorkspaceValue());

    render(<DeployWorkspacePanel />);

    expect(screen.getByRole("button", { name: /Maximize workflow panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Minimize workflow panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close workflow panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide workflow guide/i })).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Wallet" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: "API Keys" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Create site setup" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Hide workflow guide/i }));

    expect(screen.getByRole("button", { name: /Show workflow guide/i })).toBeInTheDocument();
  });

  it("keeps a dedicated minimize rail visible in maximized mode", () => {
    mockUseOptionalWorkspace.mockReturnValue(
      createWorkspaceValue({
        maximized: true,
      })
    );

    render(<DeployWorkspacePanel />);

    expect(screen.getAllByRole("button", { name: /Minimize workflow panel/i }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /Restore workflow panel/i })).toBeInTheDocument();
  });
});
