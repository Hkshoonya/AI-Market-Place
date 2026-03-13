import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminSocialPage from "./page";

const mockMutate = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe("AdminSocialPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue({
      data: {
        reports: [
          {
            id: "report-1",
            reason: "spam",
            status: "open",
            automation_state: "needs_admin_review",
            classifier_confidence: 0.72,
            created_at: "2026-03-13T00:00:00.000Z",
            post: {
              id: "post-1",
              content: "Spam content",
              status: "published",
            },
            thread: {
              id: "thread-1",
              title: "Spam thread",
            },
            reporter: {
              id: "actor-1",
              display_name: "Reporter",
              handle: "reporter",
            },
            target: {
              id: "actor-2",
              display_name: "Target",
              handle: "target",
            },
          },
        ],
      },
      isLoading: false,
      mutate: mockMutate,
    });
  });

  it("renders moderation reports and dispatches admin actions", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    );

    render(<AdminSocialPage />);

    expect(screen.getByText(/social moderation/i)).toBeInTheDocument();
    expect(screen.getByText(/spam thread/i)).toBeInTheDocument();
    expect(screen.getAllByText(/reporter/i)).toHaveLength(2);
    expect(screen.getByText(/needs_admin_review/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/social/reports/report-1",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({ action: "dismiss" }),
        })
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockMutate).toHaveBeenCalled();
    });
  });
});
