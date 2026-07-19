import { describe, expect, it } from "vitest";

import {
  getWorkspaceDeploymentBudgetSummary,
  getWorkspaceDeploymentRequestCharge,
} from "./deployment-billing";

describe("getWorkspaceDeploymentRequestCharge", () => {
  it("does not charge assistant-only deployments", () => {
    expect(
      getWorkspaceDeploymentRequestCharge({
        deploymentKind: "assistant_only",
      })
    ).toBe(0);
  });

  it("derives managed pricing from server-verified provider rates", () => {
    expect(
      getWorkspaceDeploymentRequestCharge({
        deploymentKind: "managed_api",
        runtimePricing: {
          inputPerToken: 0.000002,
          outputPerToken: 0.000008,
          request: 0,
          currency: "USD",
          source: "openrouter",
        },
      })
    ).toBe(0.06);
  });

  it("uses a conservative managed fallback when live pricing is unavailable", () => {
    expect(
      getWorkspaceDeploymentRequestCharge({
        deploymentKind: "managed_api",
      })
    ).toBe(0.25);
  });

  it("charges hosted deployments instead of passing provider cost through for free", () => {
    expect(
      getWorkspaceDeploymentRequestCharge({
        deploymentKind: "hosted_external",
      })
    ).toBe(0.5);
  });
});

describe("getWorkspaceDeploymentBudgetSummary", () => {
  it("reports healthy remaining budget", () => {
    expect(
      getWorkspaceDeploymentBudgetSummary({
        deploymentKind: "managed_api",
        runtimePricing: {
          inputPerToken: 0.000002,
          outputPerToken: 0.000008,
          request: 0,
          currency: "USD",
          source: "openrouter",
        },
        creditsBudget: 20,
        totalRequests: 10,
      })
    ).toEqual({
      requestCharge: 0.06,
      estimatedSpend: 0.6,
      budgetRemaining: 19.4,
      budgetStatus: "healthy",
    });
  });

  it("reports exhausted budget when requests consume the cap", () => {
    expect(
      getWorkspaceDeploymentBudgetSummary({
        deploymentKind: "managed_api",
        runtimePricing: {
          inputPerToken: 0.000002,
          outputPerToken: 0.000008,
          request: 0,
          currency: "USD",
          source: "openrouter",
        },
        creditsBudget: 0.12,
        totalRequests: 2,
      })
    ).toEqual({
      requestCharge: 0.06,
      estimatedSpend: 0.12,
      budgetRemaining: 0,
      budgetStatus: "exhausted",
    });
  });
});
