import Link from "next/link";
import { CalendarDays, ExternalLink, ShieldCheck, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { Profile } from "@/types/database";

interface SellerCardProps {
  seller: Pick<
    Profile,
    | "id"
    | "display_name"
    | "username"
    | "avatar_url"
    | "seller_bio"
    | "seller_website"
    | "seller_verified"
    | "seller_rating"
    | "total_sales"
    | "created_at"
  >;
}

export function SellerCard({ seller }: SellerCardProps) {
  const displayName = seller.display_name || seller.username || "Seller";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">About the Seller</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seller Info */}
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {seller.avatar_url && (
              <AvatarImage src={seller.avatar_url} alt={displayName} />
            )}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{displayName}</span>
              {seller.seller_verified && (
                <Badge className="bg-neon/10 text-neon text-[10px] border-neon/30 gap-0.5">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>
            {seller.username && (
              <p className="text-xs text-muted-foreground">@{seller.username}</p>
            )}
          </div>
        </div>

        {/* Seller Bio */}
        {seller.seller_bio && (
          <p className="text-sm text-muted-foreground">{seller.seller_bio}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
            <p className="text-lg font-bold">{seller.total_sales}</p>
            <p className="text-[11px] text-muted-foreground">Total Sales</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
            {seller.seller_rating != null ? (
              <>
                <div className="flex items-center justify-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="text-lg font-bold">{seller.seller_rating.toFixed(1)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Rating</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold">--</p>
                <p className="text-[11px] text-muted-foreground">No Ratings</p>
              </>
            )}
          </div>
        </div>

        {/* Member since */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Member since {formatDate(seller.created_at)}</span>
        </div>

        {/* Website */}
        {seller.seller_website && (
          <a
            href={seller.seller_website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-neon hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {seller.seller_website.replace(/^https?:\/\//, "")}
          </a>
        )}

        {/* View all listings */}
        <Link href={`/marketplace/browse?seller=${seller.id}`}>
          <Button variant="outline" className="w-full text-sm" size="sm">
            View All Listings
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
