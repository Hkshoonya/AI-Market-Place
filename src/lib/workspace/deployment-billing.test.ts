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
        monthlyPriceEstimate: 20,
      })
    ).toBe(0);
  });

  it("uses a sensible floor for managed deployments", () => {
    expect(
      getWorkspaceDeploymentRequestCharge({
        deploymentKind: "managed_api",
        monthlyPriceEstimate: 20,
      })
    ).toBe(0.02);
  });

  it("scales up with larger monthly estimates", () => {
    expect(
      getWorkspaceDeploymentRequestCharge({
        deploymentKind: "managed_api",
        monthlyPriceEstimate: 100,
      })
    ).toBe(0.1);
  });
});

describe("getWorkspaceDeploymentBudgetSummary", () => {
  it("reports healthy remaining budget", () => {
    expect(
      getWorkspaceDeploymentBudgetSummary({
        deploymentKind: "managed_api",
        monthlyPriceEstimate: 20,
        creditsBudget: 20,
        totalRequests: 10,
      })
    ).toEqual({
      requestCharge: 0.02,
      estimatedSpend: 0.2,
      budgetRemaining: 19.8,
      budgetStatus: "healthy",
    });
  });

  it("reports exhausted budget when requests consume the cap", () => {
    expect(
      getWorkspaceDeploymentBudgetSummary({
        deploymentKind: "managed_api",
        monthlyPriceEstimate: 20,
        creditsBudget: 0.04,
        totalRequests: 2,
      })
    ).toEqual({
      requestCharge: 0.02,
      estimatedSpend: 0.04,
      budgetRemaining: 0,
      budgetStatus: "exhausted",
    });
  });
});
