"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Menu,
  MessageSquare,
  Newspaper,
  // REMOVED: Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SearchDialog } from "@/components/search-dialog";
import { AuthButton } from "@/components/auth/auth-button";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { WalletBadge } from "@/components/marketplace/wallet-badge";

const NAV_ITEMS = [
  { href: "/models", label: "Models", icon: Activity },
  { href: "/leaderboards", label: "Leaderboards", icon: BarChart3 },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/providers", label: "Providers", icon: Building2 },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/commons", label: "Commons", icon: MessageSquare },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5" aria-label="AI Market Cap - Home">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neon/10">
            <Activity className="h-5 w-5 text-neon" aria-hidden="true" />
          </div>
          <span className="whitespace-nowrap text-base font-bold tracking-tight sm:text-lg">
            AI Market <span className="text-neon">Cap</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-neon/10 text-neon"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {profile?.is_admin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-neon/10 text-neon"
                  : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="ml-3 flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SearchDialog />

          {/* Wallet Badge */}
          <div className="hidden xl:flex">
            <WalletBadge />
          </div>

          {/* Notification Bell */}
          <div className="hidden xl:flex">
            <NotificationBell />
          </div>

          {/* Auth Button */}
          <div className="hidden xl:flex">
            <AuthButton />
          </div>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 xl:hidden" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,85dvw)] max-w-[100dvw] bg-background">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-2 pb-6" aria-label="Mobile navigation">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-neon/10 text-neon"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
                {profile?.is_admin && (
                  <>
                    <div className="my-4 border-t border-border" />
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname.startsWith("/admin")
                          ? "bg-neon/10 text-neon"
                          : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                      )}
                    >
                      <ShieldCheck className="h-5 w-5" />
                      Admin Dashboard
                    </Link>
                  </>
                )}
                <div className="my-4 border-t border-border" />
                <div className="flex flex-col gap-2">
                  <AuthButton />
                  <NotificationBell />
                </div>
                <div className="my-4 border-t border-border" />
                <Link
                  href="/wallet"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <Wallet className="h-5 w-5" />
                  Wallet
                </Link>
                <Link
                  href="/compare"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  Compare
                </Link>
                <Link
                  href="/discover"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  Discover
                </Link>
                <div className="my-2" />
                <Button className="bg-neon text-primary-foreground hover:bg-neon/90" asChild>
                  <Link href="/sell" onClick={() => setMobileOpen(false)}>List Your Model</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
