import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getMethodologyFacts } from "@/lib/methodology/facts";
import MethodologyPage, { metadata } from "./page";

const facts = getMethodologyFacts();

describe("MethodologyPage", () => {
  it("exports methodology metadata", () => {
    expect(metadata).toMatchObject({
      title: "Methodology",
      description: expect.stringMatching(/five lenses/i),
      openGraph: {
        title: "Methodology",
        url: expect.stringContaining("/methodology"),
      },
      alternates: {
        canonical: expect.stringContaining("/methodology"),
      },
    });
  });

  it("renders the verified lenses, counts, cadence, and correction link", () => {
    render(<MethodologyPage />);

    expect(screen.getByRole("heading", { name: "Methodology" })).toBeInTheDocument();
    for (const lens of facts.lenses) {
      expect(screen.getByRole("heading", { name: lens.label })).toBeInTheDocument();
    }
    expect(screen.getByText(`${facts.benchmarkCount} benchmarks`, { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText(`${facts.officialProviderCount} providers`, { exact: false })
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${facts.knownModelCount} named models`, { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText("About every hour")).toBeInTheDocument();
    expect(screen.getByText("About every 2 hours")).toBeInTheDocument();
    expect(screen.getByText("About every 4 hours")).toBeInTheDocument();
    expect(screen.getByText("About every 8 hours")).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText(/not treated as free/i)).toBeInTheDocument();
    expect(screen.queryByText(/every 6 hours/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report a correction" })).toHaveAttribute(
      "href",
      "/contact?category=bug&subject=Methodology%20correction"
    );
    expect(screen.getByRole("link", { name: "Open the leaderboards" })).toHaveAttribute(
      "href",
      "/leaderboards"
    );
  });
});
