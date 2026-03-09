import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
}

export interface ModelStatsRowProps {
  stats: StatItem[];
}

export function ModelStatsRow({ stats }: ModelStatsRowProps) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7 stagger-enhanced">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50 bg-card">
          <CardContent className="p-3 text-center">
            <stat.icon className="mx-auto h-4 w-4 text-neon mb-1" />
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
