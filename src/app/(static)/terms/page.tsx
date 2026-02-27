import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "AI Market Cap terms of service.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>

      <div className="mt-8 space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-2">By accessing and using AI Market Cap, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Use of Service</h2>
          <p className="mt-2">AI Market Cap provides information about AI models, benchmarks, and pricing for informational purposes. We do not guarantee the accuracy or completeness of any data presented.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. User Accounts</h2>
          <p className="mt-2">You are responsible for maintaining the security of your account credentials. You agree not to share your account or use the platform for any unlawful purposes.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. User Content</h2>
          <p className="mt-2">By posting comments, reviews, or ratings, you grant AI Market Cap a non-exclusive license to display this content on the platform. You retain ownership of your content.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Limitation of Liability</h2>
          <p className="mt-2">AI Market Cap is provided as-is without warranties. We are not liable for any decisions made based on the information presented on this platform.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Changes to Terms</h2>
          <p className="mt-2">We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>
        </section>
      </div>
    </div>
  );
}
