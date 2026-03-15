import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";

type ManifestValue = Record<string, unknown>;

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function OrderManifestCard({
  manifest,
}: {
  manifest: ManifestValue | null;
}) {
  if (!manifest) {
    return (
      <Card className="border-border/50 bg-card mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purchased Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This order was completed before manifest snapshots were enabled, so a
            machine-readable fulfillment contract is not available here yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const capabilities = stringList(manifest.capabilities);
  const pricing =
    manifest.pricing_model && typeof manifest.pricing_model === "object"
      ? (manifest.pricing_model as Record<string, unknown>)
      : null;
  const price =
    typeof pricing?.price === "number" ? pricing.price : Number(pricing?.price ?? 0);
  const currency = typeof pricing?.currency === "string" ? pricing.currency : "USD";

  return (
    <Card className="border-border/50 bg-card mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Purchased Contract</CardTitle>
          {typeof manifest.fulfillment_type === "string" ? (
            <Badge variant="outline">{manifest.fulfillment_type}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {typeof manifest.listing_slug === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Listing
              </p>
              <p>{manifest.listing_slug}</p>
            </div>
          ) : null}
          {typeof manifest.purchased_at === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Purchased
              </p>
              <p>{formatDate(manifest.purchased_at)}</p>
            </div>
          ) : null}
          {Number.isFinite(price) && price > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Price
              </p>
              <p>{formatCurrency(price, currency)}</p>
            </div>
          ) : null}
        </div>

        {capabilities.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
