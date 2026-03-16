import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProviderSignalBadge } from "./provider-signal-badge";

describe("ProviderSignalBadge", () => {
  it("renders signal label and timestamp", () => {
    render(
      <ProviderSignalBadge
        signal={{
          title: "OpenAI launches new model family",
          signalType: "launch",
          signalLabel: "Launch",
          signalImportance: "high",
          publishedAt: "2026-03-16T10:00:00.000Z",
          source: "provider-blog",
          relatedProvider: "OpenAI",
        }}
      />
    );

    expect(screen.getByText("Launch")).toBeInTheDocument();
  });
});
