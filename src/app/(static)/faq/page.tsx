import { HelpCircle, ChevronDown } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about AI Market Cap — how we rank models, data sources, marketplace, and more.",
};

const FAQ_SECTIONS = [
  {
    title: "General",
    items: [
      {
        q: "What is AI Market Cap?",
        a: "AI Market Cap is a platform that tracks, ranks, and compares AI models from every major provider and open-source contributor. Think of it as CoinMarketCap, but for AI models — we provide benchmark scores, pricing data, downloads, community ratings, and a marketplace for model-related products.",
      },
      {
        q: "How often is data updated?",
        a: "Model data including downloads, likes, and trending scores are refreshed every 6 hours from sources like Hugging Face. Benchmark scores and pricing are updated as new evaluations and pricing changes are published by providers.",
      },
      {
        q: "Is AI Market Cap free to use?",
        a: "Yes — browsing models, comparing benchmarks, viewing leaderboards, and most features are completely free. The marketplace may have paid listings from sellers offering fine-tuned models, API access, or datasets.",
      },
    ],
  },
  {
    title: "Rankings & Scores",
    items: [
      {
        q: "How are models ranked?",
        a: "Models are ranked using a composite scoring system that considers benchmark performance (quality score), community engagement (downloads and likes), pricing value, and Elo ratings from head-to-head arenas like LMSYS Chatbot Arena. Each factor is weighted to produce an overall rank.",
      },
      {
        q: "What is the Quality Score?",
        a: "The Quality Score (0-100) is a normalized composite of a model's benchmark results across standardized evaluations like MMLU, HellaSwag, HumanEval, and others. Higher scores indicate stronger performance across more benchmarks.",
      },
      {
        q: "What are Elo ratings?",
        a: "Elo ratings come from head-to-head comparison arenas where humans blindly compare model outputs. The rating system (similar to chess Elo) produces a relative ranking based on thousands of comparisons. We pull data from popular arenas including LMSYS Chatbot Arena.",
      },
    ],
  },
  {
    title: "Marketplace",
    items: [
      {
        q: "What can I buy on the marketplace?",
        a: "The marketplace offers API access packages, model weights, fine-tuned models, datasets, and prompt templates — all from verified sellers. Each listing includes ratings, reviews, and seller reputation scores.",
      },
      {
        q: "How do I become a seller?",
        a: 'To sell on the marketplace, sign in to your account and visit the "Sell" page. You can create listings immediately. Verified seller status (with higher visibility and trust badges) can be requested through your profile settings.',
      },
      {
        q: "Are marketplace transactions secure?",
        a: "All transactions go through our order system which tracks status from inquiry through completion. Buyers can leave reviews and ratings. We recommend reviewing seller profiles and ratings before making purchases.",
      },
    ],
  },
  {
    title: "Account & Features",
    items: [
      {
        q: "What are watchlists?",
        a: "Watchlists let you organize and track groups of AI models. Create private watchlists for your own research, or make them public so others can discover your curated collections. You can monitor changes to models in your watchlists from the activity feed.",
      },
      {
        q: "Can I compare models side by side?",
        a: "Yes — use the Compare feature to select up to 5 models for side-by-side comparison. You can compare benchmarks, pricing, capabilities, and specifications. Share comparison links with colleagues directly.",
      },
      {
        q: "How do I get API access?",
        a: "Our public API provides access to model data, rankings, benchmarks, and pricing. Visit the API Documentation page for endpoints, rate limits, and usage examples.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center mb-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neon/10">
          <HelpCircle className="h-8 w-8 text-neon" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-muted-foreground">
          Everything you need to know about AI Market Cap
        </p>
      </div>

      <div className="space-y-10">
        {FAQ_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-lg font-semibold text-neon mb-4">
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-border/50 bg-card"
                >
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium hover:text-neon transition-colors [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border/30 bg-card p-6 text-center">
        <h3 className="font-semibold">Still have questions?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Can&apos;t find what you&apos;re looking for? Reach out to us.
        </p>
        <a
          href="/contact"
          className="mt-3 inline-block rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-background hover:bg-neon/90 transition-colors"
        >
          Contact Us
        </a>
      </div>
    </div>
  );
}
