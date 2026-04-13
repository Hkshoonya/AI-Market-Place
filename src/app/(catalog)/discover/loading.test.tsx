import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DiscoverLoading from "./loading";

describe("DiscoverLoading", () => {
  it("renders the discover skeleton grid", () => {
    const { container } = render(<DiscoverLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll(".rounded-xl").length).toBeGreaterThanOrEqual(6);
  });
});
