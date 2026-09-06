import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalesInbox } from "./sales-inbox";

const mocks = vi.hoisted(() => ({ swr: vi.fn(), mutate: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("swr", () => ({ default: (...args: unknown[]) => mocks.swr(...args) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

describe("SalesInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mocks.swr.mockReturnValue({
      data: { data: [{ id: "lead-1", name: "Customer", email: "buyer@example.com", subject: "Data Pro pilot", message: "Need API data", status: "new", created_at: "2026-09-01T00:00:00Z" }] },
      isLoading: false, error: null, mutate: mocks.mutate,
    });
  });
  it("records reply status without sending email or granting access", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const onUpdate = vi.fn();
    render(<SalesInbox onUpdate={onUpdate} />);
    expect(screen.getByRole("link", { name: "Open email reply" })).toHaveAttribute("href", "mailto:buyer%40example.com?subject=Re%3A%20Data%20Pro%20pilot");
    fireEvent.click(screen.getByRole("button", { name: "Mark replied" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/admin/contact-submissions", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "lead-1", status: "replied" }),
    });
  });
  it("does not report failed saves as successful", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const onUpdate = vi.fn();
    render(<SalesInbox onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark replied" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(onUpdate).not.toHaveBeenCalled();
  });
  it("makes an unavailable inbox explicit", () => {
    mocks.swr.mockReturnValue({ error: new Error("Offline"), mutate: mocks.mutate });
    render(<SalesInbox onUpdate={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByText(/No new enquiries/)).not.toBeInTheDocument();
  });
});
