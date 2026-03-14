import { Code, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatContextWindow } from "@/lib/format";

export interface DetailsTabProps {
  architecture: string | null;
  parameter_label: string;
  context_window: number | null;
  release_date: string | null;
  status: string;
  license_name: string | null;
  license: string | null;
  is_open_weights: boolean | null;
  is_api_available: boolean;
  modalities: string[];
  capabilities: Record<string, boolean>;
}

export function DetailsTab({
  architecture,
  parameter_label,
  context_window,
  release_date,
  status,
  license_name,
  license,
  is_open_weights,
  is_api_available,
  modalities,
  capabilities,
}: DetailsTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code className="h-5 w-5 text-neon" />
            Technical Specs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Architecture", value: architecture ?? "---" },
            { label: "Parameters", value: parameter_label },
            {
              label: "Context Window",
              value: context_window ? formatContextWindow(context_window) : "---",
            },
            {
              label: "Release Date",
              value: release_date
                ? new Date(release_date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "---",
            },
            { label: "Lifecycle", value: status.replace(/_/g, " ") },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-neon" />
            License & Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "License", value: license_name ?? license ?? "---" },
            { label: "Open Weights", value: is_open_weights ? "Yes" : "No" },
            { label: "API Available", value: is_api_available ? "Yes" : "No" },
            { label: "Modalities", value: modalities.length > 0 ? modalities.join(", ") : "---" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
          <Separator />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Capabilities</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(capabilities)
                .filter(([, value]) => value)
                .map(([key]) => (
                  <Badge key={key} variant="outline" className="text-[11px]">
                    {key.replace(/_/g, " ")}
                  </Badge>
                ))}
              {Object.keys(capabilities).length === 0 && (
                <span className="text-xs text-muted-foreground">No capabilities listed</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
