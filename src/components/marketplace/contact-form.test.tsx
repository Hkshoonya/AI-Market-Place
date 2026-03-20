import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./contact-form";

const mockUser = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: mockUser(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ContactForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue({ id: "user-1" });
  });

  it("sends listing context through the connected contact route", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ContactForm
        listing={{
          id: "listing-1",
          title: "Agent Protocol Kit",
          seller_id: "seller-1",
          pricing_type: "contact",
          price: null,
        }}
      />
    );

    await user.type(
      screen.getByRole("textbox", { name: /your message to the seller/i }),
      "Interested in integration details."
    );
    await user.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/contact");
    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(request.body))).toMatchObject({
      category: "listing",
      subject: "Marketplace inquiry for Agent Protocol Kit",
      message: "Interested in integration details.",
      listing_id: "listing-1",
      seller_id: "seller-1",
    });
  });
});
