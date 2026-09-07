import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ swr: vi.fn(), mutate: vi.fn() }));
vi.mock("swr", () => ({ default: mocks.swr }));
import { BillingContent } from "./billing-content";

function overview(enabled = false) {
  return { entitlement: { plan: { name: "Explorer" }, usage: { requestCount: 15, requestLimit: 2500 } }, managed: false,
    status: null, hold: false, periodEnd: null,
    plans: [{ slug: "pro", name: "Data Pro", monthlyPriceCents: 4900, requests: 100000, checkoutEnabled: enabled }],
  };
}
beforeEach(() => { vi.clearAllMocks(); mocks.swr.mockReturnValue({ data: overview(), mutate: mocks.mutate }); });
describe("data billing page", () => {
  it("keeps purchases hidden when charging is disabled", () => {
    render(<BillingContent />);
    expect(screen.getByText("Request a pilot")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Subscribe to/ })).not.toBeInTheDocument();
  });
  it("does not mistake a Checkout redirect for successful payment", () => {
    render(<BillingContent returned />);
    expect(screen.getByRole("status")).toHaveTextContent("only after verified payment confirmation");
    expect(screen.getByText("Explorer")).toBeInTheDocument();
  });
  it("keeps cancellation available when new sales are disabled", () => {
    mocks.swr.mockReturnValue({ data: { ...overview(), managed: true }, mutate: mocks.mutate });
    render(<BillingContent />); expect(screen.getByRole("button", { name: "Manage billing" })).toBeEnabled();
  });
  it("permits retrying a pending checkout without an active subscription", () => {
    mocks.swr.mockReturnValue({ data: { ...overview(true), managed: true }, mutate: mocks.mutate });
    render(<BillingContent />); expect(screen.getByRole("button", { name: "Subscribe to Data Pro" })).toBeEnabled();
  });
  it("shows API failures and never follows untrusted redirects", async () => {
    mocks.swr.mockReturnValue({ data: overview(true), mutate: mocks.mutate });
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(Response.json({ url: "https://evil.example/pay" }));
    try {
      render(<BillingContent />); fireEvent.click(screen.getByRole("button", { name: "Subscribe to Data Pro" }));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid billing redirect"));
    } finally { globalThis.fetch = original; }
  });
});
