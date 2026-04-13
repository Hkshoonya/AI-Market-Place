import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShareModel } from "./share-model";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

describe("ShareModel", () => {
  beforeEach(() => {
    vi.stubGlobal("open", vi.fn());
    Object.defineProperty(window, "location", {
      value: { origin: "https://aimarketcap.test" },
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies the model URL and shows copied feedback", async () => {
    render(
      <ShareModel
        modelSlug="gemma-4-27b"
        modelName="Gemma 4 27B"
        provider="Google"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://aimarketcap.test/models/gemma-4-27b"
    );
    expect(await screen.findByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("opens external share windows for X and LinkedIn", async () => {
    render(
      <ShareModel
        modelSlug="kimi-k2"
        modelName="Kimi K2"
        provider="Moonshot"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Share on X" }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://twitter.com/intent/tweet?"),
      "_blank",
      "noopener,noreferrer,width=550,height=420"
    );

    fireEvent.click(screen.getByRole("button", { name: "Share on LinkedIn" }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://www.linkedin.com/sharing/share-offsite/"),
      "_blank",
      "noopener,noreferrer,width=550,height=420"
    );
  });
});
