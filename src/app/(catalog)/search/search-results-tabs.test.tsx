import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SearchResultsTabs } from "./search-results-tabs";

describe("SearchResultsTabs", () => {
  it("switches tabs immediately and keeps the URL in sync", async () => {
    const user = userEvent.setup();

    window.history.replaceState({}, "", "/search?q=gemma&tab=models");

    render(
      <SearchResultsTabs
        query="gemma"
        page={1}
        pageSize={20}
        initialTab="models"
        modelCount={12}
        marketplaceCount={3}
        modelBenchmarkCoverageSummary={{
          total: 12,
          structured: 8,
          providerReported: 2,
          arenaOnly: 1,
          pending: 1,
          notStandardized: 0,
          comparable: 8,
          signalBacked: 3,
        }}
        modelsContent={<div>Model results</div>}
        marketplaceContent={<div>Marketplace results</div>}
      />
    );

    const marketplaceTab = screen.getByRole("tab", { name: /Marketplace \(3\)/i });

    await user.click(marketplaceTab);

    expect(marketplaceTab).toHaveAttribute("data-state", "active");
    expect(window.location.search).toBe("?q=gemma&tab=marketplace");
  });
});
