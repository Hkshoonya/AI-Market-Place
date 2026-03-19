import type { ComponentProps, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Header } from "./header";

const mockUseAuth = vi.fn();
const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/search-dialog", () => ({
  SearchDialog: () => <div data-testid="search-dialog" />,
}));

vi.mock("@/components/auth/auth-button", () => ({
  AuthButton: () => <div data-testid="auth-button" />,
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock("@/components/marketplace/wallet-badge", () => ({
  WalletBadge: () => <div data-testid="wallet-badge" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("lucide-react", () => ({
  Activity: (props: ComponentProps<"svg">) => <svg data-testid="activity-icon" {...props} />,
  BarChart3: (props: ComponentProps<"svg">) => <svg {...props} />,
  Building2: (props: ComponentProps<"svg">) => <svg {...props} />,
  Menu: (props: ComponentProps<"svg">) => <svg {...props} />,
  MessageSquare: (props: ComponentProps<"svg">) => <svg {...props} />,
  Newspaper: (props: ComponentProps<"svg">) => <svg {...props} />,
  ShieldCheck: (props: ComponentProps<"svg">) => <svg {...props} />,
  ShoppingBag: (props: ComponentProps<"svg">) => <svg {...props} />,
  Sparkles: (props: ComponentProps<"svg">) => <svg {...props} />,
  Wallet: (props: ComponentProps<"svg">) => <svg {...props} />,
}));

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ profile: null });
    mockUsePathname.mockReturnValue("/");
  });

  it("keeps the full brand name visible without truncation styling", () => {
    render(<Header />);

    const brandLink = screen.getByRole("link", { name: /ai market cap - home/i });
    const brandText = screen.getByText("AI Market", { exact: false });
    const desktopNav = screen.getByRole("navigation", { name: /main navigation/i });
    const [modelsLink] = Array.from(desktopNav.querySelectorAll("a[href=\"/models\"]"));

    expect(brandLink).toHaveClass("shrink-0");
    expect(brandText).toHaveClass("whitespace-nowrap");
    expect(brandText).not.toHaveClass("truncate");
    expect(modelsLink).toHaveClass("shrink-0");
    expect(modelsLink).toHaveClass("whitespace-nowrap");
  });
});
