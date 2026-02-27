import { Card, CardContent } from "@/components/ui/card";
import { Eye, MessageSquare, ShoppingBag, Star } from "lucide-react";

interface SellerStatsProps {
  stats: {
    totalListings: number;
    activeListings: number;
    totalViews: number;
    totalInquiries: number;
    avgRating: number | null;
    pendingOrders: number;
  };
}

export function SellerStatsCards({ stats }: SellerStatsProps) {
  const cards = [
    { icon: ShoppingBag, label: "Active Listings", value: `${stats.activeListings} / ${stats.totalListings}`, color: "text-neon" },
    { icon: Eye, label: "Total Views", value: stats.totalViews.toLocaleString(), color: "text-blue-400" },
    { icon: MessageSquare, label: "Inquiries", value: `${stats.totalInquiries} (${stats.pendingOrders} pending)`, color: "text-amber-400" },
    { icon: Star, label: "Avg Rating", value: stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5.0` : "No ratings yet", color: "text-warning" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-lg font-bold">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
