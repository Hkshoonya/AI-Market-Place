import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComparisonRow } from "./comparison-row";

describe("ComparisonRow", () => {
  it("highlights the maximum numeric value", () => {
    const { container } = render(
      <table>
        <tbody>
          <ComparisonRow label="Quality Score" values={["88.2", "91.4", null]} highlight="max" />
        </tbody>
      </table>
    );

    expect(screen.getByText("Quality Score")).toBeInTheDocument();
    expect(screen.getByText("\u2014")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByText("91.4").closest("td")).toHaveClass("text-neon", "font-bold");
  });

  it("highlights the minimum numeric value", () => {
    render(
      <table>
        <tbody>
          <ComparisonRow label="Input Price" values={["$5.00", "$2.50"]} highlight="min" />
        </tbody>
      </table>
    );

    expect(screen.getByText("$2.50").closest("td")).toHaveClass("text-neon", "font-bold");
  });
});
