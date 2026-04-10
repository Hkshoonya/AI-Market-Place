"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PROVIDER_OPTIONS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Meta",
  "Mistral AI",
  "xAI",
  "Stability AI",
  "Cohere",
  "DeepSeek",
  "Microsoft",
];

const PARAM_RANGES = [
  { label: "Any", value: "" },
  { label: "< 10B", value: "0-10" },
  { label: "10B\u201370B", value: "10-70" },
  { label: "70B\u2013200B", value: "70-200" },
  { label: "> 200B", value: "200+" },
];

interface FilterSheetContentProps {
  currentProvider: string;
  currentParams: string;
  currentLicense: string;
  currentOpenOnly: boolean;
  currentDeployableOnly: boolean;
  currentManagedOnly: boolean;
  currentHasApi: boolean;
  updateParams: (updates: Record<string, string | null>) => void;
  onClearAll: () => void;
}

export function FilterSheetContent({
  currentProvider,
  currentParams,
  currentLicense,
  currentOpenOnly,
  currentDeployableOnly,
  currentManagedOnly,
  currentHasApi,
  updateParams,
  onClearAll,
}: FilterSheetContentProps) {
  return (
    <div className="mt-8 space-y-6">
      <h3 className="text-lg font-semibold">Filters</h3>

      {/* Open Weights Toggle */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Model Type</label>
        <div className="flex gap-2">
          <Button
            variant={!currentOpenOnly ? "default" : "outline"} size="sm"
            className={!currentOpenOnly ? "bg-neon text-black hover:bg-neon/90" : ""}
            onClick={() => updateParams({ open: null })}
          >
            All Models
          </Button>
          <Button
            variant={currentOpenOnly ? "default" : "outline"} size="sm"
            className={currentOpenOnly ? "bg-neon text-black hover:bg-neon/90" : ""}
            onClick={() => updateParams({ open: "true" })}
          >
            Open Weights Only
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Deployment</label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!currentDeployableOnly && !currentManagedOnly ? "default" : "outline"} size="sm"
            className={!currentDeployableOnly && !currentManagedOnly ? "bg-neon text-black hover:bg-neon/90" : ""}
            onClick={() => updateParams({ deployable: null, managed: null })}
          >
            All
          </Button>
          <Button
            variant={currentDeployableOnly ? "default" : "outline"} size="sm"
            className={currentDeployableOnly ? "bg-neon text-black hover:bg-neon/90" : ""}
            onClick={() => updateParams({ deployable: "true", managed: null })}
          >
            Ready to Use
          </Button>
          <Button
            variant={currentManagedOnly ? "default" : "outline"} size="sm"
            className={currentManagedOnly ? "bg-neon text-black hover:bg-neon/90" : ""}
            onClick={() => updateParams({ managed: "true", deployable: null })}
          >
            Deploy on AI Market Cap
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          `Ready to Use` includes all verified ways to start using a model.
          `Deploy on AI Market Cap` opens the dedicated launch directory for models AI Market Cap can run directly for you here.
        </p>
      </div>

      {/* Provider Filter */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Provider</label>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer text-xs transition-colors",
              !currentProvider
                ? "border-neon/30 bg-neon/10 text-neon"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            )}
            onClick={() => updateParams({ provider: null })}
          >
            All
          </Badge>
          {PROVIDER_OPTIONS.map((p) => (
            <Badge
              key={p} variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentProvider === p
                  ? "border-neon/30 bg-neon/10 text-neon"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              )}
              onClick={() => updateParams({ provider: currentProvider === p ? null : p })}
            >
              {p}
            </Badge>
          ))}
        </div>
      </div>

      {/* Parameter Count Filter */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Parameter Count</label>
        <div className="flex flex-wrap gap-1.5">
          {PARAM_RANGES.map((range) => (
            <Badge
              key={range.value || "any"} variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentParams === range.value
                  ? "border-neon/30 bg-neon/10 text-neon"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              )}
              onClick={() => updateParams({ params: range.value || null })}
            >
              {range.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Has API Filter */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">API Access</label>
        <div className="flex gap-2">
          <Button
            variant={!currentHasApi ? "default" : "outline"} size="sm"
            className={!currentHasApi ? "bg-neon text-black hover:bg-neon/90" : ""}
            onClick={() => updateParams({ api: null })}
          >
            All
          </Button>
          <Button
            variant={currentHasApi ? "default" : "outline"} size="sm"
            className={currentHasApi ? "bg-neon text-black hover:bg-neon/90" : ""}
            onClick={() => updateParams({ api: "true" })}
          >
            API Available
          </Button>
        </div>
      </div>

      {/* License Filter */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">License</label>
        <div className="flex flex-wrap gap-1.5">
          {["", "open_source", "commercial", "research_only"].map((lic) => (
            <Badge
              key={lic || "all"} variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentLicense === lic
                  ? "border-neon/30 bg-neon/10 text-neon"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              )}
              onClick={() => updateParams({ license: lic || null })}
            >
              {lic === "" ? "All" : lic === "open_source" ? "Open Source" : lic === "commercial" ? "Commercial" : "Research Only"}
            </Badge>
          ))}
        </div>
      </div>

      {/* Clear All */}
      <Button variant="outline" size="sm" className="w-full" onClick={onClearAll}>
        Clear All Filters
      </Button>
    </div>
  );
}
