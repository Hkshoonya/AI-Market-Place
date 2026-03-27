import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialReportButton } from "./social-report-button";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseAuth = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe("SocialReportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      profile: { display_name: "Harshit" },
      loading: false,
    });
  });

  it("submits a report to the social post report API", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ report: { id: "report-1" } }),
      })
    );

    render(<SocialReportButton postId="post-1" />);

    await user.click(screen.getByRole("button", { name: /report/i }));
    await user.selectOptions(screen.getByLabelText(/reason/i), "spam");
    await user.type(screen.getByLabelText(/details/i), "Repeated scam links");
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/social/posts/post-1/report",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({ "content-type": "application/json" }),
          body: JSON.stringify({
            reason: "spam",
            details: "Repeated scam links",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Report submitted");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
