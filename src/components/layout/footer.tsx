import Link from "next/link";
import { Activity } from "lucide-react";
import { CATEGORIES } from "@/lib/constants/categories";

const FOOTER_LINKS = {
  Platform: [
    { href: "/models", label: "Models" },
    { href: "/deploy", label: "Deploy" },
    { href: "/leaderboards", label: "Leaderboards" },
    { href: "/compare", label: "Compare" },
    { href: "/news", label: "News" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/workspace", label: "Workspace" },
    { href: "/deployments", label: "Deployments" },
    { href: "/discover", label: "Discover Watchlists" },
  ],
  Categories: CATEGORIES.slice(0, 5).map((c) => ({
    href: `/models?category=${c.slug}`,
    label: c.shortLabel,
  })),
  Company: [
    { href: "/about", label: "About" },
    { href: "/roadmap", label: "Roadmap" },
    { href: "/contact", label: "Contact" },
    { href: "/faq", label: "FAQ" },
    { href: "/providers", label: "Providers" },
    { href: "/api-docs", label: "API" },
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5" aria-label="AI Market Cap - Home">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10">
                <Activity className="h-5 w-5 text-neon" aria-hidden="true" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                AI Market <span className="text-neon">Cap</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Track, rank, and compare every AI model in the world.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <nav key={title} aria-label={`${title} links`}>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-border/50 pt-6">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AI Market Cap. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
