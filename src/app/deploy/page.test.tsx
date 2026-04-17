import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockCreatePublicClient = vi.fn();
const mockParseQueryResultPartial = vi.fn();
const mockResolveWorkspaceRuntimeExecution = vi.fn();
const mockResolveWorkspaceProvisioningForModel = vi.fn();
const mockResolveWorkspaceProvisioningHint = vi.fn();
const mockGetPublicPricingSummary = vi.fn();
const mockGetSelfHostRequirements = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResultPartial: (...args: unknown[]) => mockParseQueryResultPartial(...args),
}));

vi.mock("@/lib/models/public-families", () => ({
  dedupePublicModelFamilies: (models: unknown[]) => models,
}));

vi.mock("@/lib/models/public-surface-readiness", () => ({
  preferDefaultPublicSurfaceReady: (models: unknown[]) => models,
}));

vi.mock("@/lib/workspace/runtime-execution", () => ({
  resolveWorkspaceRuntimeExecution: (...args: unknown[]) => mockResolveWorkspaceRuntimeExecution(...args),
}));

vi.mock("@/lib/workspace/external-deployment", () => ({
  resolveWorkspaceProvisioningForModel: (...args: unknown[]) =>
    mockResolveWorkspaceProvisioningForModel(...args),
  resolveWorkspaceProvisioningHint: (...args: unknown[]) =>
    mockResolveWorkspaceProvisioningHint(...args),
}));

vi.mock("@/lib/models/pricing", () => ({
  getPublicPricingSummary: (...args: unknown[]) => mockGetPublicPricingSummary(...args),
}));

vi.mock("@/lib/models/self-host-requirements", () => ({
  getSelfHostRequirements: (...args: unknown[]) => mockGetSelfHostRequirements(...args),
}));

vi.mock("@/components/workspace/workspace-start-button", () => ({
  WorkspaceStartButton: ({ label, model }: { label: string; model?: string | null }) => (
    <button type="button">
      {label}
      {model ? `:${model}` : ""}
    </button>
  ),
}));

vi.mock("@/components/workspace/deploy-account-summary", () => ({
  DeployAccountSummary: () => <div data-testid="deploy-account-summary" />,
}));

vi.mock("@/components/models/pagination", () => ({
  Pagination: () => <div data-testid="pagination" />,
}));

function createSupabaseStub() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          range: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  };
}

const baseModels = [
  {
    id: "model_1",
    slug: "kimi-k2",
    name: "Kimi K2",
    provider: "Moonshot",
    category: "llm",
    overall_rank: 1,
    is_open_weights: false,
    parameter_count: null,
    context_window: 128000,
    hf_model_id: null,
    modalities: ["text"],
    model_pricing: [],
  },
  {
    id: "model_2",
    slug: "gemma-4-27b",
    name: "Gemma 4 27B",
    provider: "Google",
    category: "multimodal",
    overall_rank: 2,
    is_open_weights: true,
    parameter_count: 27_000_000_000,
    context_window: 128000,
    hf_model_id: "google/gemma-4-27b",
    modalities: ["text", "image"],
    model_pricing: [],
  },
];

describe("DeployPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreatePublicClient.mockReturnValue(createSupabaseStub());
    mockParseQueryResultPartial.mockReturnValue(baseModels);
    mockResolveWorkspaceRuntimeExecution.mockReturnValue({
      available: true,
      mode: "native_model",
      provider: "AI Market Cap",
      model: null,
      label: "Runs here",
      summary: "Launch inside AI Market Cap.",
    });
    mockResolveWorkspaceProvisioningHint.mockReturnValue({
      canCreate: true,
      deploymentKind: "managed_api",
      label: "AI Market Cap runtime",
      summary: "Create one saved site setup so usage stays here.",
      target: null,
    });
    mockResolveWorkspaceProvisioningForModel.mockResolvedValue({
      canCreate: true,
      deploymentKind: "managed_api",
      label: "AI Market Cap runtime",
      summary: "Create one saved site setup so usage stays here.",
      target: null,
    });
    mockGetPublicPricingSummary.mockReturnValue({
      compactPrice: 0.4,
      compactDisplay: "$0.40 / 1M tokens",
    });
    mockGetSelfHostRequirements.mockReturnValue({
      tier: "desktop_gpu",
      bestFitLabel: "Desktop GPU",
      gpuMemoryLabel: "24GB+ GPU memory",
    });
  });

  it("renders the deploy guide, focus filters, and guided setup CTAs", async () => {
    const { default: DeployPage } = await import("./page");

    render(
      await DeployPage({
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByText(/Launch AI models on AI Market Cap/i)).toBeInTheDocument();
    expect(screen.getByTestId("deploy-account-summary")).toBeInTheDocument();
    expect(screen.getByText(/Choose Your Launch Path/i)).toBeInTheDocument();
    expect(screen.getByText(/Runs fully here/i)).toBeInTheDocument();
    expect(screen.getByText(/Dedicated runtime for you/i)).toBeInTheDocument();
    expect(screen.getByText(/Open-weight launch options/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all chat launches/i })).toHaveAttribute(
      "href",
      "/deploy?focus=chat"
    );
    expect(screen.getByRole("link", { name: /View all API launches/i })).toHaveAttribute(
      "href",
      "/deploy?focus=api"
    );
    expect(screen.getByRole("link", { name: /View all low-cost launches/i })).toHaveAttribute(
      "href",
      "/deploy?focus=cost"
    );
    expect(screen.getByRole("link", { name: /View all open-weight launches/i })).toHaveAttribute(
      "href",
      "/deploy?focus=open"
    );
    expect(
      screen.getByRole("link", { name: /Show direct AI Market Cap launches/i })
    ).toHaveAttribute("href", "/deploy?focus=api");
    expect(
      screen.getByRole("link", { name: /Browse dedicated-runtime options/i })
    ).toHaveAttribute("href", "/deploy#deploy-directory");
    expect(
      screen.getByRole("link", { name: /Show open-weight launches/i })
    ).toHaveAttribute("href", "/deploy?focus=open");
    expect(screen.getByText(/Start in 3 steps/i)).toBeInTheDocument();
    expect(screen.getByText(/What one click means here/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Filter the list/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Open guided setup/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Keep using it here/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Browse launch directory/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /View Deployments/i })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Browse launch directory/i })
        .every((link) => link.getAttribute("href") === "/deploy#deploy-directory")
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Lowest cost/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open Guided Setup/i }).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Verified starting price: \$0\.40 \/ 1M tokens/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the empty launchable state when no models qualify", async () => {
    mockParseQueryResultPartial.mockReturnValue([]);

    const { default: DeployPage } = await import("./page");

    render(
      await DeployPage({
        searchParams: Promise.resolve({ focus: "api" }),
      })
    );

    expect(screen.getByText(/No launchable models found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse full model directory/i })).toBeInTheDocument();
  });
});
