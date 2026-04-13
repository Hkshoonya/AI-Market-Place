import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeployAccountSummary } from "./deploy-account-summary";

const mockUseAuth = vi.fn();
const mockUseSWR = vi.fn();

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

describe("DeployAccountSummary", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseSWR.mockReset();
  });

  it("does not render for signed-out users", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUseSWR.mockReturnValue({ data: undefined });

    const { container } = render(<DeployAccountSummary />);

    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when the signed-in user has no deployments", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user_123" }, loading: false });
    mockUseSWR.mockReturnValue({ data: { deployments: [] } });

    const { container } = render(<DeployAccountSummary />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a deployment summary for signed-in users with saved deployments", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user_123" }, loading: false });
    mockUseSWR.mockReturnValue({
      data: {
        deployments: [
          { id: "dep_1", status: "ready", healthStatus: "healthy" },
          { id: "dep_2", status: "paused", healthStatus: "paused" },
          { id: "dep_3", status: "failed", healthStatus: "error" },
        ],
      },
    });

    render(<DeployAccountSummary />);

    expect(screen.getByText(/You already have 3 managed deployments/i)).toBeInTheDocument();
    expect(screen.getByText(/1 ready/i)).toBeInTheDocument();
    expect(screen.getByText(/1 paused/i)).toBeInTheDocument();
    expect(screen.getByText(/1 need attention/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Deployments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Workspace/i })).toBeInTheDocument();
  });
});
