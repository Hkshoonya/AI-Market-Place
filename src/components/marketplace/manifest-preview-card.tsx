import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

type ManifestValue = Record<string, unknown>;

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function ManifestPreviewCard({
  manifest,
}: {
  manifest: ManifestValue | null;
}) {
  if (!manifest) return null;

  const capabilities = stringList(manifest.capabilities);
  const runtime =
    manifest.runtime && typeof manifest.runtime === "object"
      ? (manifest.runtime as Record<string, unknown>)
      : null;
  const pricing =
    manifest.pricing_model && typeof manifest.pricing_model === "object"
      ? (manifest.pricing_model as Record<string, unknown>)
      : null;
  const model = typeof pricing?.model === "string" ? pricing.model : null;
  const price =
    typeof pricing?.price === "number" ? pricing.price : Number(pricing?.price ?? 0);
  const currency = typeof pricing?.currency === "string" ? pricing.currency : "USD";

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Fulfillment Preview</CardTitle>
          {typeof manifest.fulfillment_type === "string" ? (
            <Badge variant="outline">{manifest.fulfillment_type}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {typeof manifest.summary === "string" ? (
          <p className="text-sm text-muted-foreground">{manifest.summary}</p>
        ) : null}

        {capabilities.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Capabilities
            </p>
            <div className="flex flex-wrap gap-2">
              {capabilities.map((capability) => (
                <Badge key={capability} variant="secondary">
                  {capability}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {typeof runtime?.environment === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Runtime
              </p>
              <p>{runtime.environment}</p>
            </div>
          ) : null}

          {model ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Pricing
              </p>
              <p>
                {model}
                {Number.isFinite(price) && price > 0 ? ` · ${formatCurrency(price, currency)}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
