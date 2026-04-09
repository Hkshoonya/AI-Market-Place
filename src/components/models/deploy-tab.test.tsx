import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeployTab } from "./deploy-tab";

const mockUseSWR = vi.fn();
const mockOpenWorkspace = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => ({
    openWorkspace: mockOpenWorkspace,
  }),
}));

describe("DeployTab", () => {
  it("keeps unsupported models on direct provider access with API cost guidance", () => {
    mockUseSWR.mockReturnValue({
      data: {
        deployments: [
          {
            platform: {
              id: "platform-api",
              slug: "moonshot-api",
              name: "Moonshot API",
              type: "api",
              base_url: "https://platform.moonshot.ai",
              has_affiliate: false,
              affiliate_url: null,
              affiliate_tag: null,
            },
            reason: "Model-specific access has been confirmed for this API.",
            confidence: "direct",
            deployment: {
              id: "dep-api",
              deploy_url: "https://platform.moonshot.ai/kimi-k2",
              pricing_model: "monthly",
              price_per_unit: 20,
              unit_description: "month",
              free_tier: null,
              one_click: false,
            },
          },
        ],
        relatedPlatforms: [],
        deploymentEvidence: [],
      },
      error: null,
      isLoading: false,
    });

    render(
      <DeployTab
        modelSlug="kimi-k2"
        modelName="Kimi K2"
        isOpenWeights={false}
        modalities={["text"]}
        category="llm"
      />
    );

    expect(
      screen.getByText(/AI Market Cap cannot run this model directly yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/What deployment means here/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted for you/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud server you control/i)).toBeInTheDocument();
    expect(
      screen.getByText(/metered API access\. Heavy usage can cost more than a flat subscription/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get api access on moonshot api/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start with starter pack/i })).not.toBeInTheDocument();
  });

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
            reason: "Verified path to run this exact model on a cloud server you control.",
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
            title: "MiniMax M2.7 can now run on a cloud server you control",
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
        modalities={["text"]}
        category="llm"
      />
    );

    expect(screen.getByText(/best way to start/i)).toBeInTheDocument();
    expect(screen.getByText(/If you just want the fastest verified path/i)).toBeInTheDocument();
    expect(screen.getByText(/What deployment means here/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Best when you want to start a managed deployment path without extra setup/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/What you get/i)).toBeInTheDocument();
    expect(screen.getByText(/Deployed runtime workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Chat UI/i)).toBeInTheDocument();
    expect(screen.getAllByText(/API access/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Usage tracking/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Hosted for you/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/These are official updates confirming new ways this model can be used/i)).toBeInTheDocument();
    expect(screen.getByText(/MiniMax M2.7 can now run on a cloud server you control/i)).toBeInTheDocument();
    expect(screen.getAllByText(/hosted for you/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /start with starter pack/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Starter Pack/i).length).toBeGreaterThanOrEqual(2);
  });

  it("explains cloud server requirements for open-weight models", () => {
    mockUseSWR.mockReturnValue({
      data: {
        deployments: [],
        relatedPlatforms: [
          {
            platform: {
              id: "platform-runpod",
              slug: "runpod",
              name: "Runpod",
              type: "self-hosted",
              base_url: "https://runpod.io",
              has_affiliate: false,
              affiliate_url: null,
              affiliate_tag: null,
            },
            reason: "Compatible self-hosting or local runtime for open-weight models; deployment specifics depend on the artifact format you choose.",
            confidence: "open_weight_runtime",
          },
        ],
        deploymentEvidence: [],
      },
      error: null,
      isLoading: false,
    });

    render(
      <DeployTab
        modelSlug="google-gemma-4-31b-it"
        modelName="Gemma 4 31B IT"
        isOpenWeights
        parameterCount={31_000_000_000}
        contextWindow={262_000}
        modalities={["text", "image"]}
        category="multimodal"
      />
    );

    expect(screen.getByText(/What you need to run it yourself/i)).toBeInTheDocument();
    expect(screen.getByText(/A strong GPU or rented cloud server is usually needed/i)).toBeInTheDocument();
    expect(screen.getByText(/roughly 48GB\+ GPU memory/i)).toBeInTheDocument();
    expect(screen.getByText(/31B parameters/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cloud server you control/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/On your computer/i)).toBeInTheDocument();
  });

  it("shows AI Market Cap hosted deploy when provisioning is available", () => {
    mockUseSWR.mockReturnValue({
      data: {
        deployments: [],
        relatedPlatforms: [],
        deploymentEvidence: [],
        provisioning: {
          canCreate: true,
          deploymentKind: "hosted_external",
          label: "Replicate hosted deployment",
          summary:
            "AI Market Cap can create and manage a hosted Replicate deployment for this model, then keep chat, API access, and usage tracking on-site.",
          target: {
            platformSlug: "replicate",
            provider: "replicate",
            owner: "meta",
            name: "llama-3.3-70b-instruct",
            modelRef: "meta/llama-3.3-70b-instruct",
            webUrl: "https://replicate.com/meta/llama-3.3-70b-instruct",
          },
        },
      },
      error: null,
      isLoading: false,
    });

    render(
      <DeployTab
        modelSlug="meta-llama-3-3-70b-instruct"
        modelName="Llama 3.3 70B Instruct"
        isOpenWeights
        parameterCount={70_000_000_000}
        modalities={["text"]}
        category="llm"
      />
    );

    expect(
      screen.getByRole("button", { name: /Deploy on AI Market Cap/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/hosted Replicate deployment/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Chat, API, usage tracking/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Deploy on AI Market Cap/i })
    ).toBeInTheDocument();
  });
});
