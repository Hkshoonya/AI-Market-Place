import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./wallet-content", () => ({
  default: () => <div>Wallet content shell</div>,
}));

import WalletPage, { metadata } from "./page";

describe("WalletPage", () => {
  it("exports no-index wallet metadata", () => {
    expect(metadata).toMatchObject({
      title: "Wallet",
      description: expect.stringContaining("wallet"),
      robots: { index: false, follow: false },
    });
  });

  it("renders the wallet content wrapper", () => {
    render(<WalletPage />);

    expect(screen.getByText("Wallet content shell")).toBeInTheDocument();
  });
});
