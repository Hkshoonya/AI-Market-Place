import Link from "next/link";
import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_URL } from "@/lib/constants/site";
import { getMethodologyFacts } from "@/lib/methodology/facts";

const facts = getMethodologyFacts();

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How AI Market Cap ranks models across five lenses, labels evidence, scores quality from 0 to 100, and refreshes sources on a tiered schedule.",
  openGraph: {
    title: "Methodology",
    description:
      "How AI Market Cap ranks models across five lenses, labels evidence, scores quality from 0 to 100, and refreshes sources on a tiered schedule.",
    url: `${SITE_URL}/methodology`,
  },
  alternates: {
    canonical: `${SITE_URL}/methodology`,
  },
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neon/10">
          <Scale className="h-8 w-8 text-neon" />
        </div>
        <h1 className="mt-6 text-4xl font-bold">Methodology</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          How AI Market Cap ranks and labels models. This page is the public
          record for the leaderboards.
        </p>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">What we rank</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          We publish five independent lenses so a single opaque score is never
          the whole story. Leaderboards open on {facts.defaultLensLabel} until
          another lens is selected. Sponsorship does not buy a higher model rank
          or change benchmark results.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {facts.lenses.map((lens, index) => (
            <Card key={lens.value} className="border-border/50">
              <CardContent className="p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-neon">
                  Lens {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-semibold">{lens.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{lens.description}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {lens.weightSummary}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 leading-relaxed text-muted-foreground">
          {facts.overallRankSummary}
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Evidence tiers</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Ranked benchmark claims carry an evidence badge. Arena data includes
          the LMArena leaderboard, the Chatbot Arena scores we ingest from that
          public mirror, and other head-to-head arenas such as Vision Arena.
        </p>
        <div className="mt-6 space-y-3">
          {facts.evidenceTiers.map((tier) => (
            <div
              key={tier.badgeLabel}
              className="rounded-xl border border-border/50 bg-card p-5"
            >
              <h3 className="font-semibold">{tier.badgeLabel}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{tier.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-border/50 bg-card p-8">
        <h2 className="text-2xl font-bold">Quality score (0–100)</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">{facts.qualitySummary}</p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          The scoring catalog names {facts.benchmarkCount} benchmarks.
          Structured rows are trusted when they come from{" "}
          {facts.trustedStructuredSourceCount} source families we allow, including
          the Open LLM Leaderboard, SWE-Bench, and Artificial Analysis. The
          public site groups models into {facts.categoryCount} categories.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Refresh cadence</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Source refresh is tiered by importance. {facts.rankingRecompute}{" "}
          Benchmark and pricing fields also update when new evaluations or
          provider price sheets land.
        </p>
        <div className="mt-6 space-y-4">
          {facts.cadence.map((group) => (
            <Card key={group.id} className="border-border/50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold">{group.intervalLabel}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{group.summary}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {group.sources.map((source) => (
                    <li
                      key={source}
                      className="rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground"
                    >
                      {source}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Catalog vs curated rankings</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          The public catalog is every model row we store, including packaging
          variants and rows with incomplete metadata. The homepage Models Tracked
          figure counts that full catalog. It is a different number from the
          leaderboard.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Scores are computed for active models. Preview and beta rows can
          receive current pricing, and they are left out of public score updates.
          Leaderboards then collapse variant families and keep a smaller pool of
          higher-confidence, current models. Preview, deprecated, and thin
          efficiency variants stay out of that default view.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Official-provider trust covers {facts.officialProviderCount} providers:{" "}
          {facts.officialProviderNames.join(", ")}. Hand-reviewed launch metadata
          currently covers {facts.knownModelCount} named models in the provider
          catalogs we maintain. Those records fill fields such as release dates
          and context windows. They are not a headcount of the leaderboard.
        </p>
      </section>

      <section className="mt-16 rounded-xl border border-border/50 bg-card p-8">
        <h2 className="text-2xl font-bold">Sources</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          We combine the structured benchmarks, provider documentation and pricing
          pages, arena preference data, open-weight distribution signals, and
          marketplace activity listed in the refresh schedule above. The source
          names and lens weights on this page are read from the ranking and sync
          configuration, so they change when those weights change.
        </p>
        <div className="mt-4">
          <Link href="/leaderboards" className="text-sm text-neon hover:underline">
            Open the leaderboards
          </Link>
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-border/50 bg-card p-8 text-center">
        <h2 className="text-2xl font-bold">Corrections</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          If a score, price, or evidence label looks wrong, use the Contact page
          with the model slug and what you expected. We treat methodology bugs as
          launch-blocking credibility issues.
        </p>
        <Link
          href="/contact?category=bug&subject=Methodology%20correction"
          className="mt-6 inline-block rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-background hover:bg-neon/90 transition-colors"
        >
          Report a correction
        </Link>
      </section>
    </div>
  );
}
