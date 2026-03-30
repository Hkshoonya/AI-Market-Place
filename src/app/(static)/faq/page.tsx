import { HelpCircle, ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about AI Market Cap — how we rank models, data sources, marketplace, API, agents, and more.",
  openGraph: {
    title: "FAQ",
    description:
      "Frequently asked questions about AI Market Cap — how we rank models, data sources, marketplace, API, agents, and more.",
    url: `${SITE_URL}/faq`,
  },
  alternates: {
    canonical: `${SITE_URL}/faq`,
  },
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
        a: "Source refresh cadence is tiered by importance rather than fixed to one interval. High-priority feeds sync about every 2 hours, secondary sources around every 4 hours, slower sources around every 8 hours, and low-priority reference sources daily. Benchmark scores and pricing also update as new evaluations and provider pricing changes are published.",
      },
      {
        q: "Is AI Market Cap free to use?",
        a: "Yes — browsing models, comparing benchmarks, viewing leaderboards, and most features are completely free. The marketplace may have paid listings from sellers offering fine-tuned models, API access, or datasets.",
      },
      {
        q: "Is the data real-time?",
        a: "Our data is near-real-time rather than strictly real-time. Public source refreshes run on a tiered schedule from roughly every 2 hours for the hottest feeds through daily for lower-priority sources. Benchmark scores update as new evaluations are published. Pricing data updates as providers announce changes. Marketplace listings, orders, and reviews update immediately when users act.",
      },
    ],
  },
  {
    title: "Rankings & Scores",
    items: [
      {
        q: "How are AI models ranked?",
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
        a: "The marketplace offers API access packages, model weights, fine-tuned models, datasets, prompt templates, AI agents, and MCP servers — all from verified sellers. Each listing includes ratings, reviews, and seller reputation scores.",
      },
      {
        q: "How do I list something on the marketplace?",
        a: 'To sell on the marketplace, sign in to your account and visit the "Sell" page. You can create listings immediately by providing a title, description, category, pricing, and delivery details. Verified seller status (with higher visibility and trust badges) can be requested through your profile settings after your first listing.',
      },
      {
        q: "Are marketplace transactions secure?",
        a: "Paid marketplace transactions go through the wallet and escrow system rather than raw direct transfers. Funds are held until delivery and payout conditions are met, and recent hardening work keeps order, refund, withdrawal, and auction states aligned with the actual money-moving result. We still recommend reviewing seller reputation, manifests, and ratings before purchasing.",
      },
      {
        q: "How do I report a problem with a listing or seller?",
        a: "You can report problematic listings directly from the listing page using the report button. For issues with a specific order or seller, visit your Orders page and use the report option on the relevant order. Our moderation team reviews all reports and takes action within 48 hours. You can also reach us through the Contact page for urgent issues.",
      },
    ],
  },
  {
    title: "API & Integrations",
    items: [
      {
        q: "What are API keys and how do I get one?",
        a: "API keys allow you to access AI Market Cap data programmatically — model rankings, benchmarks, pricing, and marketplace data. To get an API key, sign in to your account and visit your Settings page. You can generate and manage multiple API keys from there. Each key has configurable rate limits and permissions.",
      },
      {
        q: "Can bots and AI agents interact with the platform?",
        a: "Yes — bots, AI agents, and automated tools can interact with AI Market Cap through our API. Automated clients should use the API rather than scraping the website directly. Bots must respect rate limits and identify themselves via the User-Agent header. Bot accounts must not be used to manipulate rankings, reviews, or marketplace transactions.",
      },
      {
        q: "What are resident agents?",
        a: "Resident agents are persistent AI agents that can be configured to run on the platform and perform automated tasks like monitoring model changes, tracking price updates, curating watchlists, or managing marketplace listings on your behalf. They operate within your account's permissions and API rate limits.",
      },
      {
        q: "How does the MCP server work?",
        a: "MCP (Model Context Protocol) servers available on the marketplace provide standardized interfaces for AI models to interact with external tools and data sources. An MCP server listed on AI Market Cap can be purchased or subscribed to, then integrated into your AI workflow. Each MCP server listing includes documentation, compatibility information, and setup instructions.",
      },
      {
        q: "What are the API rate limits?",
        a: "Rate limits vary by plan. Free accounts receive a generous allocation for personal and research use. Rate limit details including requests per minute and daily quotas are documented on the API Documentation page. If you exceed your limits, requests will receive a 429 status code with a Retry-After header.",
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
        q: "How do I delete my account?",
        a: "You can delete your account from the Settings page under the Danger Zone section. Account deletion removes your profile, preferences, and personal data within 30 days. Note that public content such as reviews and comments may be anonymized rather than deleted, and marketplace transaction records are retained for legal compliance.",
      },
      {
        q: "How do I report a bug or problem?",
        a: "If you encounter a bug or technical issue, please visit our Contact page and select the appropriate category for your report. Include as much detail as possible — the page URL, what you expected to happen, and what actually happened. Screenshots are helpful. Our team reviews all reports and aims to respond within 48 hours.",
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
          Quick answers about rankings, marketplace buying, API access, and account setup.
        </p>
      </div>

      <div className="mb-12 rounded-xl border border-border/50 bg-secondary/15 p-4 text-sm text-muted-foreground">
        Start with <span className="font-medium text-foreground">General</span> if you are new,
        <span className="font-medium text-foreground"> Marketplace</span> if you want to buy or sell,
        and <span className="font-medium text-foreground"> API &amp; Integrations</span> if you are building with the platform.
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
