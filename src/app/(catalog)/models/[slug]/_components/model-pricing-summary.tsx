import Link from "next/link";
import type { RankedAccessOffer } from "@/lib/models/access-offers";
import {
  getCheapestVerifiedPricing,
  getOfficialPricing,
  getPrimaryPricingSignal,
  type VerifiedPricingEntry,
} from "@/lib/models/pricing";

interface ModelPricingSummaryProps {
  slug: string;
  provider: string;
  pricingData: VerifiedPricingEntry[];
  accessOffers: RankedAccessOffer[];
  accessAvailable: boolean;
}

function formatRate(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return "Not verified";
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 8 })}`;
}

export function ModelPricingSummary({
  slug,
  provider,
  pricingData,
  accessOffers,
  accessAvailable,
}: ModelPricingSummaryProps) {
  const context = {
    id: slug,
    slug,
    name: slug,
    provider,
    overall_rank: null,
    model_pricing: accessAvailable ? pricingData : [],
  };
  const official = getOfficialPricing(context);
  const price = official ?? getCheapestVerifiedPricing(context);
  const signal = price ? getPrimaryPricingSignal(price) : null;
  const priceDate = [price?.effective_date, price?.updated_at].find(
    (value) => value && Number.isFinite(Date.parse(value))
  );
  const subscriptions = accessAvailable
    ? accessOffers.filter((offer) => offer.kind === "subscription")
    : [];

  return (
    <section
      aria-labelledby="model-pricing-heading"
      className="mt-6 rounded-xl border border-neon/20 bg-gradient-to-br from-neon/5 to-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="model-pricing-heading" className="text-base font-semibold">
          Rates & subscription access
        </h2>
        <Link
          href={`/models/${encodeURIComponent(slug)}?tab=pricing#model-tabs`}
          className="text-sm font-medium text-neon hover:underline"
        >
          View full pricing details
        </Link>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {official ? "Official provider rates" : "Tracked access rates"}
          </h3>
          {price && signal ? (
            <>
              <p className="mt-2 text-sm font-medium">{price.provider_name}</p>
              <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                {signal.kind === "token" ? (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">Input / 1M tokens</dt>
                      <dd className="text-lg font-semibold tabular-nums">{formatRate(price.input_price_per_million)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Output / 1M tokens</dt>
                      <dd className="text-lg font-semibold tabular-nums">{formatRate(price.output_price_per_million)}</dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {signal.kind === "request" ? "Per request" : signal.kind === "gpu_second" ? "Per GPU second" : "Per month"}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatRate(signal.amount)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {priceDate
                  ? `Price record: ${new Date(priceDate).toISOString().slice(0, 10)}.`
                  : "Price verification date unavailable."}
                {price.source ? ` Source: ${price.source}.` : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {accessAvailable
                ? "Current rates are not verified. Missing pricing does not mean free usage."
                : "Live access is not confirmed for this model. No current purchase price is advertised."}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Related provider subscriptions
          </h3>
          {subscriptions.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {subscriptions.slice(0, 2).map((offer) => (
                <li key={offer.platform.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <span>{offer.platform.name}</span>
                  <span className="font-semibold tabular-nums">{offer.monthlyPriceLabel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No current subscription pricing is tracked for this model.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Confirm this specific model, usage limits, and billing terms with the provider.
            A subscription does not automatically include API credits.
          </p>
        </div>
      </div>
      <p className="mt-4 border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
        No login needed to compare. Prices are in USD; provider charges are separate from
        AI Market Cap plans. Context length, caching, tools, taxes, and regional terms can
        change the final cost. Open weights do not mean free hosting.
      </p>
    </section>
  );
}
