import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "AI Market Cap privacy policy.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>

      <div className="mt-8 space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p className="mt-2">We collect information you provide when creating an account (email, name) and data generated through your use of the platform (bookmarks, comments, ratings).</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <p className="mt-2">We use your information to provide and improve the platform, personalize your experience, and communicate important updates.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Data Storage</h2>
          <p className="mt-2">Your data is stored securely using Supabase infrastructure with encryption at rest and in transit.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Third-Party Services</h2>
          <p className="mt-2">We use third-party authentication providers (Google, GitHub) for login. Their privacy policies apply to the data they collect during authentication.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Your Rights</h2>
          <p className="mt-2">You can request deletion of your account and associated data at any time by contacting us or through your account settings.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Contact</h2>
          <p className="mt-2">For privacy-related inquiries, please reach out through the platform.</p>
        </section>
      </div>
    </div>
  );
}
