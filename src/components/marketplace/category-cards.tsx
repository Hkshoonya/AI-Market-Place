import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LISTING_TYPES } from "@/lib/constants/marketplace";

interface CategoryCardsProps {
  counts: Record<string, number>;
}

export function CategoryCards({ counts }: CategoryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {LISTING_TYPES.map((type) => (
        <Link key={type.slug} href={`/marketplace/browse?type=${type.slug}`} aria-label={`${type.label}: ${counts[type.slug] || 0} listings`}>
          <Card className="group h-full cursor-pointer border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
            <CardContent className="flex flex-col items-center p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
                <type.icon className="h-5 w-5 text-neon" />
              </div>
              <h3 className="mt-2 text-sm font-semibold group-hover:text-neon transition-colors">
                {type.label}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{type.description}</p>
              <Badge variant="outline" className="mt-2 text-[10px]">
                {counts[type.slug] || 0} listings
              </Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
