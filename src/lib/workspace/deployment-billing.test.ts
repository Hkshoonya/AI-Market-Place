import { describe, expect, it } from "vitest";

import { getWorkspaceDeploymentRequestCharge } from "./deployment-billing";

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
