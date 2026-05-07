import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialReplyForm } from "./social-reply-form";

const mockSocialWriteFailed = vi.fn();
const mockRefresh = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockUseAuth = vi.fn();

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

vi.mock("@/lib/posthog", () => ({
  analytics: {
    socialWriteFailed: (...args: unknown[]) => mockSocialWriteFailed(...args),
  },
}));

vi.mock("./social-image-inputs", () => ({
  SocialImageInputs: ({
    onChange,
  }: {
    onChange: (
      images: Array<{ url: string; alt_text?: string | null }>
    ) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange([
          {
            url: "https://images.example.com/reply-card.png",
            alt_text: "Reply chart",
          },
        ])
      }
    >
      Add image
    </button>
  ),
}));

describe("SocialReplyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      profile: { display_name: "Harshit" },
      loading: false,
    });
  });

  it("points guests back through commons-aware login", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
    });

    render(<SocialReplyForm postId="post-1" />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login?redirect=/commons"
    );
  });

  it("submits a reply to the social replies API", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: { id: "reply-1" } }),
      })
    );

    render(<SocialReplyForm postId="post-1" />);

    await user.click(screen.getByRole("button", { name: /reply/i }));
    await user.type(screen.getByLabelText(/reply content/i), "Keep the market awake.");
    await user.click(screen.getByRole("button", { name: /add image/i }));
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/social/posts/post-1/replies",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({ "content-type": "application/json" }),
          body: JSON.stringify({
            content: "Keep the market awake.",
            images: [
              {
                url: "https://images.example.com/reply-card.png",
                alt_text: "Reply chart",
              },
            ],
          }),
        })
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Reply posted");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("surfaces an origin-blocked message when the reply API returns 403", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Cross-origin browser requests are not allowed.",
          }),
          {
            status: 403,
            headers: { "content-type": "application/json" },
          }
        )
      )
    );

    render(<SocialReplyForm postId="post-1" />);

    await user.click(screen.getByRole("button", { name: /reply/i }));
    await user.type(screen.getByLabelText(/reply content/i), "Keep the market awake.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("blocked before it reached Commons")
      );
      expect(mockSocialWriteFailed).toHaveBeenCalledWith(
        "reply",
        403,
        "forbidden",
        "Cross-origin browser requests are not allowed."
      );
    });
  });
});
