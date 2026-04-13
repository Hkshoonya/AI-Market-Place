import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProviderDetailLoading from "./loading";

describe("ProviderDetailLoading", () => {
  it("renders the provider detail skeleton", () => {
    const { container } = render(<ProviderDetailLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelectorAll(".rounded-xl").length).toBeGreaterThanOrEqual(8);
  });
});
