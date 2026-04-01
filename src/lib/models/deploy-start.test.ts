import { describe, expect, it } from "vitest";

import { getDeployStartPlan } from "./deploy-start";

describe("getDeployStartPlan", () => {
  it("routes paid verified access through wallet credits", () => {
    const plan = getDeployStartPlan({
      modelSlug: "glm-5",
      modelName: "GLM-5",
      offer: {
        actionLabel: "Subscribe",
        actionUrl: "https://provider.example.com/glm-5",
        monthlyPrice: 40,
        platform: { name: "GLM Coding Plan", type: "subscription" },
      },
    });

    expect(plan).toEqual(
      expect.objectContaining({
        label: "Start with Builder Pack",
        external: false,
        recommendedAmount: 40,
        recommendedPack: expect.objectContaining({
          slug: "builder",
          label: "Builder Pack",
        }),
        recommendedPackReason: "Best when you want paid plan access through GLM Coding Plan.",
        needsWallet: true,
        experience: expect.objectContaining({
          destinationLabel: "Managed model workspace",
          unlocks: ["Hosted chat UI", "Plan-based access", "Usage visibility"],
        }),
      })
    );
    expect(plan?.href).toContain("/start?");
    expect(plan?.href).toContain("modelSlug=glm-5");
    expect(plan?.href).toContain("amount=40");
    expect(plan?.href).toContain("pack=builder");
    expect(plan?.href).toContain("packLabel=Builder+Pack");
  });

  it("keeps free-tier access as a direct external path", () => {
    const plan = getDeployStartPlan({
      modelSlug: "minimax-m2-7",
      modelName: "MiniMax M2.7",
      offer: {
        actionLabel: "Start Free Trial",
        actionUrl: "https://provider.example.com/minimax",
        monthlyPrice: 20,
        freeTier: "Free trial",
        platform: {
          name: "MiniMax Coding Plan",
          type: "subscription",
        },
      },
    });

    expect(plan).toEqual(
      expect.objectContaining({
        label: "Start Free Trial",
        external: true,
        recommendedAmount: null,
        recommendedPack: null,
        needsWallet: false,
        experience: expect.objectContaining({
          destinationLabel: "Managed model workspace",
        }),
      })
    );
  });

  it("falls back to direct provider access when in-site deployment is not available", () => {
    const plan = getDeployStartPlan({
      modelSlug: "kimi-k2",
      modelName: "Kimi K2",
      allowInSiteWorkspace: false,
      offer: {
        actionLabel: "Start API",
        actionUrl: "https://provider.example.com/kimi-k2",
        monthlyPrice: 20,
        platform: {
          name: "Kimi Code Membership",
          type: "api",
        },
      },
    });

    expect(plan).toEqual(
      expect.objectContaining({
        label: "Get API Access",
        external: true,
        recommendedAmount: 20,
        recommendedPack: expect.objectContaining({
          slug: "starter",
          label: "Starter Pack",
        }),
        needsWallet: false,
        experience: expect.objectContaining({
          destinationLabel: "Deployed runtime workspace",
        }),
      })
    );
  });

  it("falls back to the internal deploy tab when only self-host guidance exists", () => {
    const plan = getDeployStartPlan({
      modelSlug: "qwen-open",
      modelName: "Qwen Open",
      isOpenWeights: true,
    });

    expect(plan).toEqual(
      expect.objectContaining({
        label: "Self-Host",
        href: "/models/qwen-open?tab=deploy#model-tabs",
        external: false,
        experience: expect.objectContaining({
          destinationLabel: "Self-host setup",
          unlocks: ["Self-host guide", "Runtime setup steps", "Bring-your-own usage tracking"],
        }),
      })
    );
  });
});
