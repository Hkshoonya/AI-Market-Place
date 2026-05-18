import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactContent from "./contact-content";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("ContactContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders a direct support email fallback link", () => {
    render(<ContactContent />);

    expect(
      screen.getByRole("link", { name: "support@aimarketcap.tech" })
    ).toHaveAttribute("href", "mailto:support@aimarketcap.tech");
  });

  it("submits the public contact form and shows the success state", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<ContactContent />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Harshit" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "harshit@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Need help" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Need help with the site." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Harshit",
          email: "harshit@example.com",
          category: "general",
          subject: "Need help",
          message: "Need help with the site.",
        }),
      });
    });

    expect(
      await screen.findByRole("heading", { name: "Message Sent!" })
    ).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Message sent successfully");
  });

  it("surfaces server-side failures instead of pretending the message was sent", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to save your message. Please try again." }),
    } as Response);

    render(<ContactContent />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Harshit" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "harshit@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Need help" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Need help with the site." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    expect(
      await screen.findByText("Failed to save your message. Please try again.")
    ).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      "Failed to send message. Please try again."
    );
  });
});
