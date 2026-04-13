import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeploymentsContent from "./deployments-content";

const mockUseSWR = vi.fn();
const mockUseAuth = vi.fn();
const mockPush = vi.fn();
const mockFetch = vi.fn();

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

describe("DeploymentsContent", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;

    mockUseAuth.mockReturnValue({
      user: { id: "user_123" },
      loading: false,
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
    expect(screen.getByRole("link", { name: /Find models hosted here/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse all deployable models/i })).toBeInTheDocument();
    expect(screen.getByText(/How To Use This Page/i)).toBeInTheDocument();
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
    expect(screen.getByText(/How To Use This Page/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Quick Test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pause/i })).toBeInTheDocument();
    expect(screen.getByText(/Budget and billing controls/i)).toBeInTheDocument();
    expect(screen.getByText(/API setup and test/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Recent activity/i).length).toBeGreaterThanOrEqual(1);

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
});
