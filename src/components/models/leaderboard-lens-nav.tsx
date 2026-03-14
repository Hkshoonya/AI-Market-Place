import {
  BarChart3,
  Briefcase,
  DollarSign,
  Scale,
  TrendingUp,
} from "lucide-react";

const LENSES = [
  {
    title: "Capability",
    description: "Pure technical ability across benchmarks, arenas, and agent tasks.",
    icon: BarChart3,
    accent: "text-[#00d4aa]",
    bg: "bg-[#00d4aa]/10",
  },
  {
    title: "Popularity",
    description: "Blended public attention plus real-world traction and trend persistence.",
    icon: TrendingUp,
    accent: "text-[#f59e0b]",
    bg: "bg-[#f59e0b]/10",
  },
  {
    title: "Adoption",
    description: "Observed practical footprint across providers, routing, and sustained usage proxies.",
    icon: Briefcase,
    accent: "text-[#6366f1]",
    bg: "bg-[#6366f1]/10",
  },
  {
    title: "Economic Footprint",
    description: "Evidence-weighted economic presence combining adoption, monetization, and distribution.",
    icon: DollarSign,
    accent: "text-[#22c55e]",
    bg: "bg-[#22c55e]/10",
  },
  {
    title: "Value",
    description: "Capability relative to cost for practical buyers comparing utility per dollar.",
    icon: Scale,
    accent: "text-[#ec4899]",
    bg: "bg-[#ec4899]/10",
  },
];

export function LeaderboardLensNav() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {LENSES.map((lens) => {
        const Icon = lens.icon;

        return (
          <div
            key={lens.title}
            className="rounded-2xl border border-border/50 bg-card/60 p-4"
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
          </div>
        );
      })}
    </div>
  );
}
