"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Box,
  CircleDollarSign,
  Database,
  Flag,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/models", label: "Models", icon: Box },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/listings", label: "Listings", icon: ShoppingBag },
  { href: "/admin/verifications", label: "Verify", icon: ShieldCheck },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/admin/social", label: "Social", icon: Flag },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/data-sources", label: "Sources", icon: Database },
  { href: "/admin/agents", label: "Agents", icon: Bot },
  { href: "/admin/monetization", label: "Revenue", icon: CircleDollarSign },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon/15 bg-neon/10">
          <LayoutDashboard className="h-5 w-5 text-neon" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Operations, users, data, and revenue
          </p>
        </div>
      </div>

      <div className="relative mb-7 sm:mb-8">
        <nav
          aria-label="Admin sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-border/40 bg-secondary/25 p-1.5 [scrollbar-width:thin]"
        >
          {ADMIN_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-3.5 ${
                  isActive
                    ? "bg-neon/10 text-neon shadow-[inset_0_0_0_1px_rgba(0,212,170,0.12)]"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-gradient-to-l from-background/70 to-transparent sm:hidden" />
      </div>

      {children}
    </div>
  );
}
