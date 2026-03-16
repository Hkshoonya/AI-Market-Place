import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LaunchRadar } from "./launch-radar";

describe("LaunchRadar", () => {
  it("renders structured radar items", () => {
    render(
      <LaunchRadar
        items={[
          {
            id: "launch-1",
            title: "Introducing GPT-5",
            summary: "High-capability release",
            url: "https://openai.com",
            related_provider: "OpenAI",
            published_at: "2026-03-16T12:00:00.000Z",
            signalType: "launch",
            signalLabel: "Launches",
            signalImportance: "high",
          },
        ]}
      />
    );

    expect(screen.getByText("Launch Radar")).toBeInTheDocument();
    expect(screen.getByText("Introducing GPT-5")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view source/i })).toHaveAttribute(
      "href",
      "https://openai.com"
    );
  });
});
