import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CategoryLoading from "./loading";

describe("CategoryLoading", () => {
  it("renders the category loading skeleton", () => {
    const { container } = render(<CategoryLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelectorAll(".rounded-xl").length).toBeGreaterThanOrEqual(9);
  });
});
