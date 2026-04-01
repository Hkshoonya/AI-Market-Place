import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeployTab } from "./deploy-tab";

const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

describe("DeployTab", () => {
  it("shows official deployment evidence when the API returns it", () => {
    mockUseSWR.mockReturnValue({
      data: {
        deployments: [
          {
            platform: {
              id: "platform-1",
              slug: "ollama-cloud",
              name: "Ollama Cloud",
              type: "hosting",
              base_url: "https://ollama.com/library",
              has_affiliate: false,
              affiliate_url: null,
              affiliate_tag: null,
            },
            reason: "Model-specific deployment or pricing has been confirmed for this platform.",
            confidence: "direct",
            deployment: {
              id: "dep-1",
              deploy_url: "https://ollama.com/library/minimax-m2.7",
              pricing_model: "monthly",
              price_per_unit: 20,
              unit_description: "month",
              free_tier: null,
              one_click: true,
            },
          },
        ],
        relatedPlatforms: [],
        deploymentEvidence: [
          {
            id: "news-1",
            title: "MiniMax M2.7 is now available on Ollama Cloud",
            summary: "Official runtime evidence for managed deployment.",
            source: "ollama-library",
            signalLabel: "API",
            signalType: "api",
            signalImportance: "medium",
            url: "https://ollama.com/library/minimax-m2.7",
          },
        ],
      },
      error: null,
      isLoading: false,
    });

    render(
      <DeployTab
        modelSlug="minimax-minimax-m2-7"
        modelName="MiniMax M2.7"
        isOpenWeights={false}
      />
    );

    expect(screen.getByText(/best way to start/i)).toBeInTheDocument();
    expect(screen.getByText(/If you just want the fastest verified path/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Best when you want to start a managed deployment path without extra setup/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/What this path should unlock/i)).toBeInTheDocument();
    expect(screen.getByText(/Deployed runtime workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Chat UI/i)).toBeInTheDocument();
    expect(screen.getAllByText(/API access/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Usage tracking/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Managed cloud/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/official deployment evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/MiniMax M2.7 is now available on Ollama Cloud/i)).toBeInTheDocument();
    expect(screen.getAllByText(/managed cloud/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: /start with starter pack/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/wallet?")
    );
    expect(screen.getAllByText(/Starter Pack/i).length).toBeGreaterThanOrEqual(2);
  });
});
