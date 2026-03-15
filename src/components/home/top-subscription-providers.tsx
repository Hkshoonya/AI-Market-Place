import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RankedAccessOffer } from "@/lib/models/access-offers";

interface TopSubscriptionProvidersProps {
  offers: RankedAccessOffer[];
}

export function TopSubscriptionProviders({ offers }: TopSubscriptionProvidersProps) {
  if (offers.length === 0) {
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Top Subscription Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No verified subscription plans are available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="text-lg">Top Subscription Providers</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ranked for user value, trust, affordability, and real utility breadth.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                  Monthly
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">
                  Value & Trust
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground xl:table-cell">
                  Best For
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer, index) => (
                <tr key={offer.platform.id} className="border-b border-border/30">
                  <td className="px-4 py-3.5">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        index < 3 ? "text-neon" : "text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{offer.platform.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {offer.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {offer.topModels.length > 0
                          ? `Covers ${offer.topModels.map((model) => model.name).join(", ")}`
                          : `${offer.modelCount} tracked models`}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3.5 text-right text-sm font-medium md:table-cell">
                    {offer.monthlyPriceLabel}
                    {offer.freeTier && (
                      <div className="text-[10px] uppercase tracking-[0.14em] text-gain">
                        Trial
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3.5 text-right lg:table-cell">
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold tabular-nums">{offer.score.toFixed(0)}</div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Value {offer.userValueScore.toFixed(0)} · Trust {offer.trustScore.toFixed(0)}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3.5 text-sm text-muted-foreground xl:table-cell">
                    {offer.bestFor}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="space-y-1">
                      <a
                        href={offer.actionUrl}
                        target="_blank"
                        rel={offer.partnerDisclosure ? "noopener sponsored" : "noopener noreferrer"}
                        className="inline-flex items-center gap-1 rounded-md bg-neon px-2.5 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-neon/90"
                      >
                        {offer.actionLabel}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {offer.partnerDisclosure && (
                        <div className="text-[10px] text-muted-foreground">
                          {offer.partnerDisclosure}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end px-4 py-4">
          <Link href="/skills" className="text-sm font-medium text-neon hover:underline">
            Explore access-aware skills discovery
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

