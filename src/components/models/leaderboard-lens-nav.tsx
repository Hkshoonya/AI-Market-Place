import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  DollarSign,
  Scale,
  TrendingUp,
} from "lucide-react";
import { type PublicRankingLens } from "@/lib/models/public-lenses";

const LENSES = [
  {
    value: "capability" as const,
    title: "Capability",
    description: "Pure technical ability across benchmarks, arenas, and agent tasks.",
    icon: BarChart3,
    accent: "text-[#00d4aa]",
    bg: "bg-[#00d4aa]/10",
  },
  {
    value: "popularity" as const,
    title: "Popularity",
    description: "Blended public attention plus real-world traction and trend persistence.",
    icon: TrendingUp,
    accent: "text-[#f59e0b]",
    bg: "bg-[#f59e0b]/10",
  },
  {
    value: "adoption" as const,
    title: "Adoption",
    description: "Observed practical footprint across providers, routing, and sustained usage proxies.",
    icon: Briefcase,
    accent: "text-[#6366f1]",
    bg: "bg-[#6366f1]/10",
  },
  {
    value: "economic" as const,
    title: "Economic Footprint",
    description: "Evidence-weighted economic presence combining adoption, monetization, and distribution.",
    icon: DollarSign,
    accent: "text-[#22c55e]",
    bg: "bg-[#22c55e]/10",
  },
  {
    value: "value" as const,
    title: "Value",
    description: "Capability relative to cost for practical buyers comparing utility per dollar.",
    icon: Scale,
    accent: "text-[#ec4899]",
    bg: "bg-[#ec4899]/10",
  },
];

interface LeaderboardLensNavProps {
  activeLens: PublicRankingLens;
  lifecycle: "active" | "all";
  buildHref: (lens: PublicRankingLens) => string;
}

export function LeaderboardLensNav({
  activeLens,
  lifecycle,
  buildHref,
}: LeaderboardLensNavProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {LENSES.map((lens) => {
        const Icon = lens.icon;
        const isActive = activeLens === lens.value;
        const href = buildHref(lens.value);

        return (
          <Link
            key={lens.title}
            href={href}
            data-active={isActive ? "true" : "false"}
            data-lifecycle={lifecycle}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-2xl border p-4 transition-colors hover:border-neon/30 hover:bg-card ${
              isActive
                ? "border-neon/40 bg-neon/5"
                : "border-border/50 bg-card/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${lens.bg}`}>
                <Icon className={`h-5 w-5 ${lens.accent}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{lens.title}</h3>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {lens.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
