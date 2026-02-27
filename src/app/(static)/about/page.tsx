import { Activity, Globe, Users, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "About AI Market Cap — the definitive platform for tracking AI models.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neon/10">
          <Activity className="h-8 w-8 text-neon" />
        </div>
        <h1 className="mt-6 text-4xl font-bold">About AI Market Cap</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          We track, rank, and compare every AI model in the world — giving developers, researchers, and businesses the data they need to make informed decisions.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        {[
          { icon: Globe, title: "Global Coverage", desc: "Tracking AI models from every major provider and open-source contributor worldwide." },
          { icon: Zap, title: "Real-Time Data", desc: "Benchmark scores, pricing, downloads, and rankings updated every 6 hours." },
          { icon: Users, title: "Community Driven", desc: "Rate, review, and discuss models with thousands of AI practitioners." },
        ].map((item) => (
          <Card key={item.title} className="border-border/50">
            <CardContent className="p-6 text-center">
              <item.icon className="mx-auto h-8 w-8 text-neon" />
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-border/50 bg-card p-8">
        <h2 className="text-2xl font-bold">Our Mission</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          The AI landscape is evolving at breakneck speed. New models launch daily, benchmarks shift weekly, and pricing changes constantly. AI Market Cap exists to bring clarity to this chaos — providing a single, reliable source of truth for the entire AI model ecosystem.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Whether you are choosing between foundation models for your startup, evaluating open-source alternatives, or tracking the latest breakthroughs in reasoning and multimodal AI, we have you covered with comprehensive data, transparent rankings, and community insights.
        </p>
      </div>
    </div>
  );
}
