import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CompareLoading from "./loading";

describe("CompareLoading", () => {
  it("renders the compare skeleton structure", () => {
    const { container } = render(<CompareLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelectorAll(".border-dashed").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll(".rounded-xl").length).toBeGreaterThanOrEqual(4);
  });
});
