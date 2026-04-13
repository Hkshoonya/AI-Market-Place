import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProvidersLoading from "./loading";

describe("ProvidersLoading", () => {
  it("renders the provider directory skeleton", () => {
    const { container } = render(<ProvidersLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelectorAll(".rounded-xl").length).toBeGreaterThanOrEqual(9);
  });
});
