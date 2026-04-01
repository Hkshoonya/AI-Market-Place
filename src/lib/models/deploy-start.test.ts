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
        platform: { name: "GLM Coding Plan" },
      },
    });

    expect(plan).toEqual(
      expect.objectContaining({
        label: "Start with Credits",
        external: false,
        recommendedAmount: 40,
        needsWallet: true,
      })
    );
    expect(plan?.href).toContain("/wallet?");
    expect(plan?.href).toContain("modelSlug=glm-5");
    expect(plan?.href).toContain("amount=40");
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
      },
    });

    expect(plan).toEqual(
      expect.objectContaining({
        label: "Start Free Trial",
        external: true,
        recommendedAmount: null,
        needsWallet: false,
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
      })
    );
  });
});
