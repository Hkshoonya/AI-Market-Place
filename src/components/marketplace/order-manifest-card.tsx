import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";

type ManifestValue = Record<string, unknown>;

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
  const pricing = objectValue(manifest.pricing_model);
  const runtime = objectValue(manifest.runtime);
  const access = objectValue(manifest.access);
  const verification = objectValue(manifest.verification);
  const rights = objectValue(manifest.rights);
  const support = objectValue(manifest.support);
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
          {typeof manifest.schema_version === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Schema
              </p>
              <p>{manifest.schema_version}</p>
            </div>
          ) : null}
        </div>

        {typeof manifest.summary === "string" && manifest.summary.trim().length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Contract Summary
            </p>
            <p className="text-sm text-muted-foreground">{manifest.summary}</p>
          </div>
        ) : null}

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

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {typeof runtime?.environment === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Runtime
              </p>
              <p>{runtime.environment}</p>
            </div>
          ) : null}
          {typeof access?.endpoint === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Access Endpoint
              </p>
              <p className="break-all">{access.endpoint}</p>
            </div>
          ) : null}
          {typeof access?.mode === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Access Mode
              </p>
              <p>{access.mode}</p>
            </div>
          ) : null}
          {typeof verification?.source === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Verification Source
              </p>
              <p>{verification.source}</p>
            </div>
          ) : null}
          {typeof rights?.scope === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Rights Scope
              </p>
              <p>{rights.scope}</p>
            </div>
          ) : null}
          {typeof support?.level === "string" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Support
              </p>
              <p>{support.level}</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
