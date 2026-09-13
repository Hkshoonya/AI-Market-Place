import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DirectoryCandidateSchema } from "@/lib/models/directory-data";

const mocks = vi.hoisted(() => ({ candidates: vi.fn(), deployments: vi.fn(), from: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/models/directory-data", async (original) => ({
  ...(await original<typeof import("@/lib/models/directory-data")>()),
  getDirectoryCandidates: mocks.candidates,
  getDirectoryDeployments: mocks.deployments,
}));
vi.mock("@/lib/supabase/public-server", () => ({ createPublicClient: () => ({ from: mocks.from }) }));
vi.mock("@/components/models/models-filter-bar", () => ({
  ModelsFilterBar: ({ totalCount }: { totalCount: number }) => <p>{`Result count: ${totalCount}`}</p>,
}));
vi.mock("@/components/models/pagination", () => ({
  Pagination: ({ currentPage }: { currentPage: number }) => <p>{`Current page: ${currentPage}`}</p>,
}));
vi.mock("@/components/shared/provider-logo", () => ({ ProviderLogo: () => <span /> }));

function model(id: number) {
  const fields = Object.fromEntries(Object.keys(DirectoryCandidateSchema.shape)
    .filter((key) => key !== "model_pricing").map((key) => [key, null]));
  return DirectoryCandidateSchema.parse({
    ...fields, id: `id-${id}`, slug: `sample-${id}`, name: `Sample ${id}`,
    provider: "Example", category: "llm", status: "active", hf_downloads: 1,
    hf_likes: 0, is_api_available: true, overall_rank: id + 1,
  });
}

function query(data: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    then: (resolve: (result: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.candidates.mockResolvedValue({ data: Array.from({ length: 35 }, (_, id) => model(id)), count: 35 });
  mocks.deployments.mockResolvedValue([]);
  mocks.from.mockImplementation((table: string) => {
    if (table === "model_deployments") throw new Error("Directory must not build a giant deployment IN query");
    return query([]);
  });
});

describe("ModelsPage", () => {
  it("renders the selected page and only hydrates details for its model IDs", async () => {
    const { default: ModelsPage } = await import("./page");
    render(await ModelsPage({ searchParams: Promise.resolve({ page: "2" }) }));
    expect(screen.getByRole("heading", { name: "AI Models Directory" })).toBeInTheDocument();
    expect(screen.getByText("Current page: 2")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(16);
    expect(screen.queryByText("Sample 0")).not.toBeInTheDocument();
    const details = mocks.from.mock.results.find((_result, index) => mocks.from.mock.calls[index][0] === "models")?.value;
    expect(details.in).toHaveBeenCalledWith("id", Array.from({ length: 15 }, (_, index) => `id-${index + 20}`));
  });

  it.each(["invalid", "0", "-2", "1.5"])("uses page one for invalid page input %s", async (page) => {
    const { default: ModelsPage } = await import("./page");
    render(await ModelsPage({ searchParams: Promise.resolve({ page }) }));
    expect(screen.getByText("Current page: 1")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(21);
  });

  it("keeps only matching available deployments and reports the filtered count", async () => {
    mocks.deployments.mockResolvedValue([
      { model_id: "id-4", platform_id: "platform", status: "available", pricing_model: "hourly", price_per_unit: 1, one_click: true },
      { model_id: "outside-directory", platform_id: "platform", status: "available" },
    ]);
    const { default: ModelsPage } = await import("./page");
    render(await ModelsPage({ searchParams: Promise.resolve({ deployable: "true" }) }));
    expect(screen.getByText("Result count: 1")).toBeInTheDocument();
    expect(screen.getByText("Sample 4")).toBeInTheDocument();
    expect(mocks.deployments).toHaveBeenCalledTimes(1);
  });

  it("does not show unfiltered pagination when no deployable models match", async () => {
    const { default: ModelsPage } = await import("./page");
    render(await ModelsPage({ searchParams: Promise.resolve({ deployable: "true" }) }));
    expect(screen.getByText("Result count: 0")).toBeInTheDocument();
    expect(screen.getByText("No models found")).toBeInTheDocument();
  });

  it("does not silently hide a failed availability lookup", async () => {
    mocks.deployments.mockRejectedValue(new Error("Unable to load availability"));
    const { default: ModelsPage } = await import("./page");
    await expect(ModelsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Unable to load availability");
  });
});
