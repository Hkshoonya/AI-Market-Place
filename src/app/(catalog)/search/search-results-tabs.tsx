"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { Box, ShoppingBag } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BenchmarkTrackingCoverageSummary } from "@/lib/models/benchmark-status";

type SearchTabValue = "models" | "marketplace";

interface SearchResultsTabsProps {
  query: string;
  page: number;
  pageSize: number;
  initialTab: SearchTabValue;
  modelCount: number;
  marketplaceCount: number;
  modelBenchmarkCoverageSummary: BenchmarkTrackingCoverageSummary;
  modelsContent: ReactNode;
  marketplaceContent: ReactNode;
}

function buildSearchHref(query: string, tab: SearchTabValue, page: number) {
  const params = new URLSearchParams({ q: query, tab });

  if (page > 1) {
    params.set("page", String(page));
  }

  return `/search?${params.toString()}`;
}

export function SearchResultsTabs({
  query,
  page,
  pageSize,
  initialTab,
  modelCount,
  marketplaceCount,
  modelBenchmarkCoverageSummary,
  modelsContent,
  marketplaceContent,
}: SearchResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<SearchTabValue>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const modelTotalPages = Math.ceil(modelCount / pageSize);
  const marketplaceTotalPages = Math.ceil(marketplaceCount / pageSize);

  const syncTabUrl = (nextTab: SearchTabValue) => {
    if (typeof window === "undefined") {
      return;
    }

    window.history.replaceState(
      window.history.state,
      "",
      buildSearchHref(query, nextTab, page)
    );
  };

  const handleTabChange = (nextTab: string) => {
    const normalizedTab = nextTab === "marketplace" ? "marketplace" : "models";
    setActiveTab(normalizedTab);
    syncTabUrl(normalizedTab);
  };

  return (
    <>
      <div className="mb-6 rounded-xl border border-border/50 bg-secondary/15 p-4 text-sm text-muted-foreground">
        Start with the tab that matches your goal:
        models if you want to compare AI systems, marketplace if you want something you can buy,
        deploy, or use right away.
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-0">
        <TabsList className="mb-6 h-auto w-full justify-start bg-transparent p-0">
          <TabsTrigger
            value="models"
            className="mr-1 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-neon/10 data-[state=active]:text-neon"
          >
            <Box className="h-4 w-4" />
            Models ({modelCount})
          </TabsTrigger>
          <TabsTrigger
            value="marketplace"
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-neon/10 data-[state=active]:text-neon"
          >
            <ShoppingBag className="h-4 w-4" />
            Marketplace ({marketplaceCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent forceMount value="models">
          <div hidden={activeTab !== "models"}>
            <div className="mb-6 rounded-xl border border-border/50 bg-card/50 p-4 text-sm text-muted-foreground">
              Search results include both fully benchmarked models and tracked models that are still supported mainly by provider evidence, arena signal, or other public signals. Use the benchmark badge on each row before treating two models as directly comparable.
            </div>
            {modelCount > 0 && (
              <div className="mb-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                  <p className="text-lg font-semibold text-foreground">
                    {modelBenchmarkCoverageSummary.comparable}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Structured benchmark-backed results
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                  <p className="text-lg font-semibold text-foreground">
                    {modelBenchmarkCoverageSummary.signalBacked}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signal-backed results without full normalized tables
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                  <p className="text-lg font-semibold text-foreground">
                    {modelBenchmarkCoverageSummary.pending}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Benchmark-expected results still catching up
                  </p>
                </div>
              </div>
            )}
            {modelsContent}
            {modelTotalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {modelTotalPages}
                </p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={buildSearchHref(query, "models", page - 1)}
                      className="rounded-lg border border-border/50 px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                    >
                      Previous
                    </Link>
                  )}
                  {page < modelTotalPages && (
                    <Link
                      href={buildSearchHref(query, "models", page + 1)}
                      className="rounded-lg border border-border/50 px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent forceMount value="marketplace">
          <div hidden={activeTab !== "marketplace"}>
            {marketplaceContent}
            {marketplaceTotalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {marketplaceTotalPages}
                </p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={buildSearchHref(query, "marketplace", page - 1)}
                      className="rounded-lg border border-border/50 px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                    >
                      Previous
                    </Link>
                  )}
                  {page < marketplaceTotalPages && (
                    <Link
                      href={buildSearchHref(query, "marketplace", page + 1)}
                      className="rounded-lg border border-border/50 px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
