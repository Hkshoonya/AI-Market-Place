"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Rocket, Activity, Layers, Globe, BarChart3, Download, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Dynamic import with SSR disabled — Three.js only runs in browser
const NeuralNetworkScene = dynamic(
  () =>
    import("@/components/three/neural-network-scene").then(
      (mod) => mod.NeuralNetworkScene
    ),
  { ssr: false }
);

interface HeroStats {
  modelCount: number;
  categoryCount: number;
  providerCount: number;
  benchmarkCount: number;
  totalDownloads?: number;
  totalLikes?: number;
}

function formatStatValue(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

const STAT_CONFIGS = [
  { key: "modelCount", icon: Activity, label: "Models Tracked" },
  { key: "providerCount", icon: Globe, label: "Providers" },
  { key: "benchmarkCount", icon: BarChart3, label: "Benchmarks" },
  { key: "totalDownloads", icon: Download, label: "Total Downloads" },
  { key: "totalLikes", icon: Heart, label: "Community Likes" },
  { key: "categoryCount", icon: Layers, label: "Categories" },
] as const;

export function HeroSection({ stats }: { stats: HeroStats }) {
  const statEntries = STAT_CONFIGS.filter(
    (s) => stats[s.key as keyof HeroStats] != null && stats[s.key as keyof HeroStats]! > 0
  ).slice(0, 6);

  return (
    <section className="relative overflow-hidden border-b border-border/50" style={{ minHeight: "85vh" }}>
      {/* Three.js Background — desktop only */}
      <div className="hidden md:block">
        <NeuralNetworkScene />
      </div>

      {/* Mobile fallback gradient */}
      <div className="absolute inset-0 z-0 md:hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-neon/5 via-transparent to-transparent" />
        <div className="absolute left-1/2 top-1/4 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-neon/5 blur-[120px]" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 md:py-32">
        <div className="text-center animate-fade-in">
          <Badge
            variant="outline"
            className="mb-6 border-neon/30 bg-neon/5 px-3 py-1 text-xs text-neon backdrop-blur-sm"
          >
            <Rocket className="mr-1.5 h-3 w-3" />
            Tracking {stats.modelCount}+ AI Models Worldwide
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl animate-slide-up" style={{ animationDelay: "100ms" }}>
            The{" "}
            <span className="text-neon text-glow">Market Cap</span>
            <br />
            for AI Models
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl animate-slide-up"
            style={{ animationDelay: "200ms" }}
          >
            Track, rank, and compare every AI model in the world. Real-time
            benchmarks, pricing intelligence, and a marketplace — all in one
            place.
          </p>

          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-4 animate-slide-up"
            style={{ animationDelay: "300ms" }}
          >
            <Button
              size="lg"
              className="bg-neon text-background font-semibold hover:bg-neon/90 shadow-[0_0_20px_rgba(0,212,170,0.3)]"
              asChild
            >
              <Link href="/models">
                Explore Models
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="backdrop-blur-sm" asChild>
              <Link href="/leaderboards">View Leaderboards</Link>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div
          className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 stagger-children animate-slide-up"
          style={{ animationDelay: "400ms" }}
        >
          {statEntries.map((stat) => {
            const Icon = stat.icon;
            const value = stats[stat.key as keyof HeroStats] ?? 0;
            return (
              <Card
                key={stat.key}
                className="border-border/50 bg-card/30 backdrop-blur-md hover:bg-card/50 transition-all duration-300 hover:border-neon/20"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neon/10">
                    <Icon className="h-5 w-5 text-neon" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums truncate lg:text-2xl">
                      {formatStatValue(value)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {stat.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
