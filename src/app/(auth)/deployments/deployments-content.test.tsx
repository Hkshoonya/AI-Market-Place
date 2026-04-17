import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeploymentsContent from "./deployments-content";

const mockUseSWR = vi.fn();
const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockPush = vi.fn();
const mockFetch = vi.fn();
const mockOpenWorkspace = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/deployments",
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

const baseDeployment = {
  id: "dep_123",
  modelSlug: "kimi-k2",
  modelName: "Kimi K2",
  providerName: "Moonshot",
  status: "ready",
  healthStatus: "healthy",
  endpointPath: "/api/deployments/kimi-k2",
  endpointSlug: "kimi-k2",
  deploymentKind: "hosted_external",
  deploymentLabel: "AI Market Cap dedicated runtime",
  execution: {
    summary: "Dedicated runtime attached to AI Market Cap",
  },
  billing: {
    estimatedSpend: 12.5,
    requestCharge: 0.02,
    budgetRemaining: 23.5,
    budgetStatus: "healthy",
  },
  creditsBudget: 50,
  totalRequests: 18,
  totalTokens: 3200,
  lastSuccessAt: "2026-04-13T00:00:00.000Z",
  lastErrorMessage: null,
  successfulRequests: 17,
  failedRequests: 1,
  successRate: 94,
  avgResponseLatencyMs: 420,
  lastResponseLatencyMs: 390,
};


const failedDeployment = {
  ...baseDeployment,
  id: "dep_failed",
  modelSlug: "grok-4",
  modelName: "Grok 4",
  status: "failed",
  healthStatus: "error",
  endpointPath: "/api/deployments/grok-4",
  endpointSlug: "grok-4",
  billing: {
    ...baseDeployment.billing,
    budgetStatus: "exhausted",
    budgetRemaining: 0,
  },
  lastErrorMessage: "Provider returned a 500 during the last request.",
};

const pausedDeployment = {
  ...baseDeployment,
  id: "dep_paused",
  modelSlug: "claude-opus-4-6",
  modelName: "Claude Opus 4.6",
  status: "paused",
  healthStatus: "paused",
  endpointPath: "/api/deployments/claude-opus-4-6",
  endpointSlug: "claude-opus-4-6",
};

const provisioningDeployment = {
  ...baseDeployment,
  id: "dep_provisioning",
  modelSlug: "gemini-2-5-pro",
  modelName: "Gemini 2.5 Pro",
  status: "provisioning",
  healthStatus: "idle",
  endpointPath: "/api/deployments/gemini-2-5-pro",
  endpointSlug: "gemini-2-5-pro",
};

describe("DeploymentsContent", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockFetch.mockReset();
    mockOpenWorkspace.mockReset();
    global.fetch = mockFetch as typeof fetch;

    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
    });
    mockUseWorkspace.mockReturnValue({
      openWorkspace: mockOpenWorkspace,
    });
  });

  it("shows the empty deployments state with the primary next actions", () => {
    const emptySnapshot = { deployments: [] };
    mockUseSWR.mockImplementation((key: string | null) => {
      if (key === "/api/workspace/deployments") {
        return {
          data: emptySnapshot,
          mutate: vi.fn(),
        };
      }

      return {
        data: undefined,
        mutate: vi.fn(),
      };
    });

    render(<DeploymentsContent />);

    expect(screen.getByText(/No deployments yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Start guided setup/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /Browse launch directory/i }).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByRole("link", { name: /Browse launch directory/i }).every((link) =>
        link.getAttribute("href") === "/deploy#deploy-directory"
      )
    ).toBe(true);
    expect(screen.getByText(/Operations flow/i)).toBeInTheDocument();
    expect(screen.getByText(/State first, top actions next, details only when needed\./i)).toBeInTheDocument();
    expect(screen.getByText(/^Ready$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Paused$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Provisioning$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Needs repair$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Action queue/i)).not.toBeInTheDocument();
  });

  it("surfaces an action queue when deployments need review, resume, or setup follow-up", () => {
    const deploymentSnapshot = {
      deployments: [failedDeployment, pausedDeployment, provisioningDeployment],
    };

    mockUseSWR.mockImplementation((key: string | null) => {
      if (key === "/api/workspace/deployments") {
        return {
          data: deploymentSnapshot,
          mutate: vi.fn(),
        };
      }

      if (key?.includes("/activity")) {
        return {
          data: { activity: [], events: [] },
          mutate: vi.fn(),
        };
      }

      return {
        data: undefined,
        mutate: vi.fn(),
      };
    });

    render(<DeploymentsContent />);

    expect(screen.getByText(/Action queue/i)).toBeInTheDocument();
    expect(screen.getByText(/1 attention/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1 paused/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1 provisioning/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Triage broken, paused, or still-preparing deployments before returning to live traffic\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review attention first/i })).toHaveAttribute(
      "href",
      "#deployment-grok-4"
    );
    expect(screen.getByRole("link", { name: /Resume paused deployment/i })).toHaveAttribute(
      "href",
      "#deployment-claude-opus-4-6"
    );
    expect(screen.getByRole("link", { name: /Watch setup in progress/i })).toHaveAttribute(
      "href",
      "#deployment-gemini-2-5-pro"
    );
  });

  it("renders deployment controls and records a quick test response", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    const deploymentSnapshot = { deployments: [baseDeployment] };
    const activitySnapshot = { activity: [], events: [] };

    mockUseSWR.mockImplementation((key: string | null) => {
      if (key === "/api/workspace/deployments") {
        return {
          data: deploymentSnapshot,
          mutate,
        };
      }

      if (key === `/api/workspace/deployments/${baseDeployment.id}/activity`) {
        return {
          data: activitySnapshot,
          mutate: vi.fn(),
        };
      }

      return {
        data: undefined,
        mutate: vi.fn(),
      };
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          content: "Deployment for Kimi K2 is working.",
          model: "Kimi K2",
          provider: "AI Market Cap",
        },
      }),
    });

    render(<DeploymentsContent />);

    expect(screen.getByText(/Managed model deployments/i)).toBeInTheDocument();
    expect(screen.getByText(/Operations flow/i)).toBeInTheDocument();
    expect(
      screen.getByText(/State first, top actions next, details only when needed\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Run a quick test, then use this endpoint directly or continue from workspace\./i)).toBeInTheDocument();
    expect(screen.getByText(/Next step/i)).toBeInTheDocument();
    expect(screen.getByText(/Primary actions/i)).toBeInTheDocument();
    expect(screen.getByText(/Secondary actions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Ready$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(baseDeployment.endpointPath)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Quick Test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Needs attention/i })).toBeInTheDocument();
    expect(screen.getByText(/Deployment filters/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Search deployments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage Budget/i })).toHaveAttribute(
      "href",
      `#deployment-budget-${baseDeployment.id}`
    );
    expect(screen.getByRole("button", { name: /^Copy$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open deployment workflow/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(screen.getByText(/Live snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/Performance details/i)).toBeInTheDocument();
    expect(screen.getByText(/Requests: 18/i)).toBeInTheDocument();
    expect(screen.getByText(/Tokens: 3200/i)).toBeInTheDocument();
    expect(screen.getByText(/Budget and billing controls/i)).toBeInTheDocument();
    expect(screen.getByText(/API access details/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Recent activity/i).length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole("button", { name: /Open deployment workflow/i }));

    expect(mockOpenWorkspace).toHaveBeenCalledWith({
      model: baseDeployment.modelName,
      modelSlug: baseDeployment.modelSlug,
      provider: baseDeployment.providerName,
      action: "Use live deployment",
      nextUrl: `/models/${baseDeployment.modelSlug}?tab=deploy#model-tabs`,
      autoStartDeployment: false,
      suggestedAmount: baseDeployment.creditsBudget,
    });

    await user.click(screen.getByRole("button", { name: /Run Quick Test/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        baseDeployment.endpointPath,
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    expect(await screen.findByText(/Latest test response/i)).toBeInTheDocument();
    expect(screen.getByText(/Deployment for Kimi K2 is working\./i)).toBeInTheDocument();
    expect(mutate).toHaveBeenCalled();
  });

  it("filters deployments by status and search query", async () => {
    const user = userEvent.setup();
    const deploymentSnapshot = {
      deployments: [baseDeployment, failedDeployment, pausedDeployment],
    };

    mockUseSWR.mockImplementation((key: string | null) => {
      if (key === "/api/workspace/deployments") {
        return {
          data: deploymentSnapshot,
          mutate: vi.fn(),
        };
      }

      if (key?.includes("/activity")) {
        return {
          data: { activity: [], events: [] },
          mutate: vi.fn(),
        };
      }

      return {
        data: undefined,
        mutate: vi.fn(),
      };
    });

    render(<DeploymentsContent />);

    await user.click(screen.getByRole("button", { name: /Needs attention/i }));

    expect(screen.getByText("Grok 4")).toBeInTheDocument();
    expect(screen.queryByText("Kimi K2")).not.toBeInTheDocument();
    expect(screen.queryByText("Claude Opus 4.6")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Paused/i }));

    expect(screen.getByText("Claude Opus 4.6")).toBeInTheDocument();
    expect(screen.queryByText("Grok 4")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: /Search deployments/i }));
    await user.type(screen.getByRole("textbox", { name: /Search deployments/i }), "grok");

    expect(screen.getByText(/No deployments match this view/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Start another guided setup/i })).toHaveAttribute(
      "href",
      "/deploy#deploy-directory"
    );

    await user.click(screen.getByRole("button", { name: /Clear search and filters/i }));

    expect(screen.getByText("Kimi K2")).toBeInTheDocument();
    expect(screen.getByText("Grok 4")).toBeInTheDocument();
    expect(screen.getByText("Claude Opus 4.6")).toBeInTheDocument();
  });
});
