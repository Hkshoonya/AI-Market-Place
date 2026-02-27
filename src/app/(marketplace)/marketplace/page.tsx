import Link from "next/link";
import {
  ArrowRight,
  Code,
  Database,
  FileText,
  Key,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Marketplace",
  description: "Buy and sell AI models, APIs, datasets, and fine-tuned models.",
};

const LISTING_TYPES = [
  { icon: Key, label: "API Access", desc: "Access models via API", count: 245 },
  { icon: Package, label: "Model Weights", desc: "Download model weights", count: 128 },
  { icon: Code, label: "Fine-tuned Models", desc: "Task-specific models", count: 89 },
  { icon: Database, label: "Datasets", desc: "Training & eval data", count: 312 },
  { icon: FileText, label: "Prompt Templates", desc: "Optimized prompts", count: 156 },
];

const FEATURED_LISTINGS = [
  {
    title: "GPT-4o Fine-tuned for Medical QA",
    seller: "MedAI Labs",
    type: "Fine-tuned Model",
    price: 499,
    rating: 4.8,
    reviews: 24,
    sales: 156,
  },
  {
    title: "Enterprise Code Review API",
    seller: "CodeGuard AI",
    type: "API Access",
    price: 29,
    priceUnit: "/mo",
    rating: 4.9,
    reviews: 87,
    sales: 520,
  },
  {
    title: "Multi-language NER Dataset (50 langs)",
    seller: "DataForge",
    type: "Dataset",
    price: 199,
    rating: 4.7,
    reviews: 42,
    sales: 234,
  },
  {
    title: "Legal Document Analysis Model",
    seller: "LexAI",
    type: "Fine-tuned Model",
    price: 899,
    rating: 4.6,
    reviews: 18,
    sales: 89,
  },
  {
    title: "Real-time Voice Clone API",
    seller: "VoiceAI Studio",
    type: "API Access",
    price: 49,
    priceUnit: "/mo",
    rating: 4.5,
    reviews: 63,
    sales: 345,
  },
  {
    title: "Product Photography Generator",
    seller: "PixelPerfect AI",
    type: "API Access",
    price: 19,
    priceUnit: "/mo",
    rating: 4.8,
    reviews: 112,
    sales: 890,
  },
];

export default function MarketplacePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-6 w-6 text-neon" />
              <h1 className="text-2xl font-bold">AI Marketplace</h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              Buy and sell AI models, APIs, datasets, and more.
            </p>
          </div>
          <Button className="bg-neon text-background font-semibold hover:bg-neon/90" asChild>
            <Link href="/sell">
              Start Selling
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {LISTING_TYPES.map((type) => (
          <Card
            key={type.label}
            className="group cursor-pointer border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon"
          >
            <CardContent className="flex flex-col items-center p-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
                <type.icon className="h-5 w-5 text-neon" />
              </div>
              <h3 className="mt-2 text-sm font-semibold group-hover:text-neon transition-colors">
                {type.label}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{type.desc}</p>
              <Badge variant="outline" className="mt-2 text-[10px]">
                {type.count} listings
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Featured Listings */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">Featured Listings</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_LISTINGS.map((listing) => (
            <Card
              key={listing.title}
              className="group cursor-pointer border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon"
            >
              <CardContent className="p-5">
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  {listing.type}
                </Badge>
                <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors line-clamp-2">
                  {listing.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  by {listing.seller}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    <span className="text-sm font-medium">{listing.rating}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ({listing.reviews} reviews)
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {listing.sales} sales
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-neon">
                    ${listing.price}
                    {listing.priceUnit && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {listing.priceUnit}
                      </span>
                    )}
                  </span>
                  <Button size="sm" variant="outline" className="h-8 text-xs">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA for sellers */}
      <Card className="mt-12 border-neon/20 bg-gradient-to-r from-neon/5 via-neon/10 to-neon/5">
        <CardContent className="flex flex-col items-center p-8 text-center md:flex-row md:text-left md:justify-between">
          <div>
            <h2 className="text-xl font-bold">Have an AI model to sell?</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Join hundreds of AI creators selling their models, APIs, and datasets on AI Market Cap.
            </p>
          </div>
          <Button className="mt-4 bg-neon text-background font-semibold hover:bg-neon/90 md:mt-0" asChild>
            <Link href="/sell">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
